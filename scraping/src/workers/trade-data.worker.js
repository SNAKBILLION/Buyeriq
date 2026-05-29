// ─────────────────────────────────────────────
// BuyerIQ — Trade Data Worker
// ─────────────────────────────────────────────
// Processes: trade_data_ingestion_queue
// Sources:  UN COMTRADE, Frankfurter (FX)
// Pipeline: API → Raw Storage → Clean → DB
// ─────────────────────────────────────────────
import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { QUEUES, JOB_TYPES, PRIORITY_MARKETS } from '../config/constants.js';
import { comtradeConnector } from '../connectors/api/comtrade.connector.js';
import { frankfurterConnector } from '../connectors/api/frankfurter.connector.js';
import { CensusConnector } from '../connectors/api/census.connector.js';
import { tariffConnector } from '../connectors/api/tariff.connector.js';
import { saveRaw } from '../pipeline/raw-storage.js';
import { cleanTradeRecord, dedup, filterIncomplete } from '../pipeline/cleaner.js';
import { insertTradeStatistics } from '../pipeline/db-inserter.js';
import { query } from '../config/database.js';
import { recordJobResult } from '../monitoring/job-tracker.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('worker:trade');

// ── Job Handlers ─────────────────────────────
const handlers = {
  /**
   * Fetch India export data to priority markets
   */
  async [JOB_TYPES.COMTRADE_FETCH](job) {
    const { year } = job.data;
    const targetYear = year || new Date().getFullYear() - 1;

    log.info(`Fetching India exports for ${targetYear}`);
    job.updateProgress(10);

    // 1. Fetch from COMTRADE API
    const rawRecords = await comtradeConnector.getIndiaExports(targetYear);
    job.updateProgress(30);

    // 2. Save raw data
    await saveRaw('trade', 'comtrade', rawRecords, {
      jobId: job.id,
      query: `india-exports-${targetYear}`,
    });
    job.updateProgress(50);

    // 3. Clean
    const cleaned = rawRecords.map(cleanTradeRecord);
    const deduped = dedup(cleaned, (r) => `${r.reporter_code}:${r.partner_code}:${r.hs_code}:${r.year}`);
    const valid = filterIncomplete(deduped, ['reporter_code', 'partner_code', 'hs_code', 'trade_value_usd', 'year'], 4);
    job.updateProgress(70);

    // 4. Insert into PostgreSQL
    const result = await insertTradeStatistics(valid);
    job.updateProgress(100);

    return {
      source: 'comtrade',
      type: 'india_exports',
      year: targetYear,
      raw_count: rawRecords.length,
      cleaned_count: valid.length,
      inserted: result.inserted,
    };
  },

  /**
   * Fetch bilateral trade: India → specific country
   */
  async [JOB_TYPES.COMTRADE_FETCH_COMPETITORS](job) {
    const { year } = job.data;
    const targetYear = year || new Date().getFullYear() - 1;
    log.info(`Fetching competitor exports for ${targetYear}`);
    job.updateProgress(10);

    const rawRecords = await comtradeConnector.getCompetitorExports(targetYear);
    job.updateProgress(40);

    await saveRaw('trade', 'comtrade_competitors', rawRecords, { jobId: job.id });
    job.updateProgress(50);

    const cleaned = rawRecords.map(cleanTradeRecord);
    const deduped = dedup(cleaned, r => `${r.reporter_code}:${r.partner_code}:${r.hs_code}:${r.year}`);
    const valid = filterIncomplete(deduped, ['reporter_code','partner_code','hs_code','trade_value_usd','year'], 4);
    job.updateProgress(70);

    const result = await insertTradeStatistics(valid);
    job.updateProgress(100);

    log.info(`Competitor data: ${valid.length} records inserted`);
    return { source: 'comtrade_competitors', year: targetYear, raw: rawRecords.length, inserted: result.inserted };
  },


  async [JOB_TYPES.COMTRADE_BILATERAL](job) {
    const { partnerCode, yearStart, yearEnd } = job.data;

    log.info(`Fetching bilateral trade: IND → ${partnerCode}`);
    job.updateProgress(10);

    const rawRecords = await comtradeConnector.getBilateralTrade(
      partnerCode,
      yearStart || new Date().getFullYear() - 5,
      yearEnd || new Date().getFullYear() - 1
    );

    await saveRaw('trade', 'comtrade', rawRecords, {
      jobId: job.id,
      query: `bilateral-${partnerCode}`,
    });
    job.updateProgress(50);

    const cleaned = rawRecords.map(cleanTradeRecord);
    const deduped = dedup(cleaned, (r) => `${r.reporter_code}:${r.partner_code}:${r.hs_code}:${r.year}`);
    const valid = filterIncomplete(deduped, ['reporter_code', 'partner_code', 'hs_code', 'trade_value_usd', 'year'], 4);

    const result = await insertTradeStatistics(valid);
    job.updateProgress(100);

    return {
      source: 'comtrade',
      type: 'bilateral',
      partner: partnerCode,
      raw_count: rawRecords.length,
      cleaned_count: valid.length,
      inserted: result.inserted,
    };
  },

  /**
   * Fetch US imports from all origins (competitive landscape)
   */
  async [JOB_TYPES.USITC_FETCH](job) {
    const { year } = job.data;
    const targetYear = year || new Date().getFullYear() - 1;

    log.info(`Fetching US imports for ${targetYear}`);

    const rawRecords = await comtradeConnector.getUSImports(targetYear);

    await saveRaw('trade', 'comtrade', rawRecords, {
      jobId: job.id,
      query: `us-imports-${targetYear}`,
    });

    const cleaned = rawRecords.map(cleanTradeRecord);
    const deduped = dedup(cleaned, (r) => `${r.reporter_code}:${r.partner_code}:${r.hs_code}:${r.year}`);
    const valid = filterIncomplete(deduped, ['reporter_code', 'partner_code', 'hs_code', 'trade_value_usd', 'year'], 4);

    const result = await insertTradeStatistics(valid);

    return {
      source: 'comtrade',
      type: 'us_imports',
      year: targetYear,
      raw_count: rawRecords.length,
      cleaned_count: valid.length,
      inserted: result.inserted,
    };
  },


  /**
   * Fetch US imports via Census Bureau (monthly)
   */
  async [JOB_TYPES.CENSUS_FETCH](job) {
    const { year } = job.data;
    const census = new CensusConnector();
    const targetYear = year || new Date().getFullYear() - 1;

    log.info(`Census fetch: ${targetYear}`);
    job.updateProgress(10);

    const rawRecords = await census.fetchAll(targetYear);
    job.updateProgress(50);

    await saveRaw('trade', 'census', rawRecords, { jobId: job.id });
    job.updateProgress(70);

    const valid = rawRecords.filter(r => r.trade_value_usd > 0);
    const result = await insertTradeStatistics(valid);
    job.updateProgress(100);

    return {
      source: 'census_bureau',
      type: 'us_imports_monthly',
      year: targetYear,
      raw_count: rawRecords.length,
      inserted: result.inserted,
    };
  },

  /**
   * Update currency rates
   */
  async [JOB_TYPES.CURRENCY_UPDATE](job) {
    log.info('Updating currency rates');

    const rates = await frankfurterConnector.getLatestRates('USD');

    await saveRaw('trade', 'currency', rates, {
      jobId: job.id,
      query: 'latest-rates',
    });

    return {
      source: 'frankfurter',
      type: 'currency_update',
      base: rates.base,
      date: rates.date,
      currencies: Object.keys(rates.rates).length,
    };
  },


  async [JOB_TYPES.WITS_FETCH](job) {
    const { hsCodes } = job.data;
    log.info('Fetching tariff advantage data...');
    job.updateProgress(10);

    const codes = hsCodes || ['4419','4420','7323','7013','6911','6912','7615','3924'];
    const results = tariffConnector.getAllTariffs(codes);
    job.updateProgress(50);

    const tariffRows = results.flatMap((r) => {
      const rows = [
        {
          hs_code: r.hs_code,
          market: r.country,
          price: r.mfn_rate,
          price_type: 'tariff_mfn',
          raw_data: { ...r, stored_rate_type: 'mfn' },
        },
      ];

      if (r.preferential_rate !== null && r.preferential_rate !== undefined) {
        rows.push({
          hs_code: r.hs_code,
          market: r.country,
          price: r.preferential_rate,
          price_type: 'tariff_preferential',
          raw_data: { ...r, stored_rate_type: 'preferential' },
        });
      }

      return rows;
    });

    let inserted = 0;
    for (const row of tariffRows) {
      try {
        const res = await query(
          `INSERT INTO price_data
            (hs_code, source_type, source_name, price, currency, price_type, marketplace, scraped_at, confidence, raw_data)
           SELECT $1, 'calculated', 'official_treaty', $2, 'PCT', $3, $4, NOW(), 'verified', $5::jsonb
           WHERE NOT EXISTS (
             SELECT 1
             FROM price_data
             WHERE hs_code = $1
               AND source_name = 'official_treaty'
               AND price_type = $3
               AND marketplace = $4
               AND price = $2
           )`,
          [
            row.hs_code,
            row.price,
            row.price_type,
            row.market,
            JSON.stringify(row.raw_data),
          ]
        );
        inserted += res.rowCount;
      } catch (e) {
        log.warn(`Tariff insert failed: ${e.message}`);
      }
    }

    job.updateProgress(100);

    log.info(`Tariff data: ${results.length} records, ${inserted} inserted`);
    return {
      source: 'tariff_connector',
      total_records: results.length,
      inserted,
      top_advantages: tariffConnector.getTopAdvantageMarkets('4419').slice(0, 5),
    };
  },
};

// ── Worker Setup ─────────────────────────────

export function startTradeDataWorker() {
  const worker = new Worker(
    QUEUES.TRADE_DATA,
    async (job) => {
      const handler = handlers[job.name];
      if (!handler) {
        throw new Error(`Unknown job type: ${job.name}`);
      }

      const startTime = Date.now();
      try {
        const result = await handler(job);
        await recordJobResult(job, 'completed', result, Date.now() - startTime);
        return result;
      } catch (err) {
        await recordJobResult(job, 'failed', { error: err.message }, Date.now() - startTime);
        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
      stalledInterval: parseInt(process.env.WORKER_STALLED_INTERVAL || '30000', 10),
      drainDelay: 30,
    }
  );

  worker.on('completed', (job, result) => {
    log.info(`✓ Trade job completed: ${job.name}`, { jobId: job.id, result });
  });

  worker.on('failed', (job, err) => {
    log.error(`✗ Trade job failed: ${job?.name}`, { jobId: job?.id, error: err.message });
  });

  log.info('Trade data worker started');
  return worker;
}

export default { startTradeDataWorker };
