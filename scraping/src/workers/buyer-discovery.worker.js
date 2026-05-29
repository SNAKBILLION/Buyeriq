// ─────────────────────────────────────────────
// BuyerIQ — Buyer Discovery Worker
// ─────────────────────────────────────────────
// Processes: buyer_discovery_queue
// Strategy:  ImportYeti HS search + procurement
//            page scanning for new buyer leads.
// Pipeline:  Scrape → Raw → Clean → DB
// ─────────────────────────────────────────────
import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { QUEUES, JOB_TYPES, TARGET_HS_CODES, TARGET_HS_CODES_4DIGIT } from '../config/constants.js';
import { importYetiScraper } from '../connectors/scrapers/importyeti.scraper.js';
import { saveRaw } from '../pipeline/raw-storage.js';
import { cleanBuyerRecord, dedup, filterIncomplete } from '../pipeline/cleaner.js';
import { insertCompanies } from '../pipeline/db-inserter.js';
import { recordJobResult } from '../monitoring/job-tracker.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('worker:buyer');

// FIX: All 4-digit HS codes to rotate through — not just first one
const ALL_HS_CODES = TARGET_HS_CODES_4DIGIT || ['4419', '4420', '7323', '7013', '6911', '6912', '7615', '3924'];

const handlers = {
  /**
   * Scan ImportYeti HS codes to discover new importers
   * FIX: Rotates through ALL HS codes daily, not just 4419
   */
  async [JOB_TYPES.BUYER_PROCUREMENT_SCAN](job) {
    const { hsCode, keyword } = job.data;

    // FIX: If no specific HS code given, rotate by day of month
    const dayIndex = new Date().getDate() % ALL_HS_CODES.length;
    const targetHS = hsCode || ALL_HS_CODES[dayIndex];

    log.info(`Buyer discovery scan: HS ${targetHS} (day rotation: ${dayIndex})`);
    job.updateProgress(10);

    await importYetiScraper.launch();
    try {
      let rawData;

      if (keyword) {
        rawData = await importYetiScraper.searchByProduct(keyword);
      } else {
        rawData = await importYetiScraper.searchByHSCode(targetHS);
      }
      job.updateProgress(40);

      const items = rawData.importers || rawData.results || [];

      await saveRaw('buyers', 'discovery', items, {
        jobId: job.id,
        query: keyword || `hs-${targetHS}`,
      });
      job.updateProgress(50);

      // Clean as buyer/company records
      const cleaned = items.map((item) =>
        cleanBuyerRecord({
          company_name: item.company_name,
          country: item.country,
          buyer_type: item.type || 'importer',
          website: item.profile_url,
          _source: 'importyeti',
        })
      );

      const deduped = dedup(cleaned, (r) => `${r.company_name}:${r.country}`);
      const valid = filterIncomplete(deduped, ['company_name'], 1);
      job.updateProgress(70);

      const result = await insertCompanies(valid);
      job.updateProgress(100);

      return {
        source: 'importyeti',
        type: 'buyer_discovery',
        query: keyword || `HS ${targetHS}`,
        raw_count: items.length,
        cleaned_count: valid.length,
        inserted: result.inserted,
      };
    } finally {
      await importYetiScraper.close();
    }
  },

  /**
   * Enrich an existing buyer profile with shipment data
   */
  async [JOB_TYPES.BUYER_PROFILE_ENRICH](job) {
    const { companyName, buyerId } = job.data;

    log.info(`Enriching buyer profile: ${companyName}`);
    job.updateProgress(10);

    await importYetiScraper.launch();
    try {
      const rawData = await importYetiScraper.searchCompany(companyName);
      job.updateProgress(50);

      await saveRaw('buyers', 'enrichment', rawData, {
        jobId: job.id,
        query: companyName,
      });

      // Extract enrichment signals
      const enrichment = {
        company_name: companyName,
        total_shipments: rawData.company?.totalShipments || null,
        top_suppliers: (rawData.suppliers || []).slice(0, 10),
        recent_shipments: (rawData.shipments || []).slice(0, 20),
        supplier_countries: [...new Set(
          (rawData.suppliers || []).map((s) => s.country).filter(Boolean)
        )],
        _source: 'importyeti',
        _enrichedAt: new Date().toISOString(),
      };

      job.updateProgress(100);

      return {
        source: 'importyeti',
        type: 'buyer_enrichment',
        company: companyName,
        buyerId,
        suppliers_found: enrichment.top_suppliers.length,
        shipments_found: enrichment.recent_shipments.length,
      };
    } finally {
      await importYetiScraper.close();
    }
  },
};

export function startBuyerDiscoveryWorker() {
  const worker = new Worker(
    QUEUES.BUYER_DISCOVERY,
    async (job) => {
      const handler = handlers[job.name];
      if (!handler) throw new Error(`Unknown job type: ${job.name}`);

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
      concurrency: 1,
      stalledInterval: 60000,
      drainDelay: 30,
    }
  );

  worker.on('completed', (job, result) => {
    log.info(`✓ Buyer discovery completed: ${job.name}`, { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    log.error(`✗ Buyer discovery failed: ${job?.name}`, { jobId: job?.id, error: err.message });
  });

  log.info('Buyer discovery worker started');
  return worker;
}

export default { startBuyerDiscoveryWorker };
