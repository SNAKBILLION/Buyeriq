// ─────────────────────────────────────────────
// BuyerIQ — Shipment Intelligence Worker
// ─────────────────────────────────────────────
// Processes: shipment_scraper_queue
// Sources:  ImportYeti (US customs BOL data)
// Pipeline: Scrape → Raw → Clean → DB
// ─────────────────────────────────────────────
import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { QUEUES, JOB_TYPES } from '../config/constants.js';
import { importYetiScraper } from '../connectors/scrapers/importyeti.scraper.js';
import { zaubaScraper, ZaubaScraper } from '../connectors/scrapers/zauba.scraper.js';
import { saveRaw } from '../pipeline/raw-storage.js';
import { cleanShipmentRecord, cleanBuyerRecord, dedup, filterIncomplete } from '../pipeline/cleaner.js';
import { insertShipmentRecords, insertCompanies } from '../pipeline/db-inserter.js';
import { recordJobResult } from '../monitoring/job-tracker.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('worker:shipment');

const handlers = {
  /**
   * Search ImportYeti for a specific company's shipment data
   */
  async [JOB_TYPES.IMPORTYETI_COMPANY](job) {
    const { companyName } = job.data;

    log.info(`Scraping ImportYeti for: ${companyName}`);
    job.updateProgress(10);

    await importYetiScraper.launch();
    try {
      const rawData = await importYetiScraper.searchCompany(companyName);
      job.updateProgress(40);

      await saveRaw('shipments', 'importyeti', rawData, {
        jobId: job.id,
        query: companyName,
      });
      job.updateProgress(50);

      // Clean shipment records
      const cleanedShipments = rawData.shipments.map(cleanShipmentRecord);
      const dedupedShipments = dedup(cleanedShipments, (r) =>
        `${r.importer_name}:${r.exporter_name}:${r.shipment_date}:${r.hs_code}`
      );
      const validShipments = filterIncomplete(dedupedShipments,
        ['importer_name', 'exporter_name', 'shipment_date'], 2
      );
      job.updateProgress(70);

      // Insert shipments
      const shipmentResult = await insertShipmentRecords(validShipments);
      job.updateProgress(100);

      return {
        source: 'importyeti',
        type: 'company_shipments',
        company: companyName,
        raw_shipments: rawData.shipments.length,
        raw_suppliers: rawData.suppliers?.length || 0,
        cleaned_shipments: validShipments.length,
        inserted: shipmentResult.inserted,
      };
    } finally {
      await importYetiScraper.close();
    }
  },

  /**
   * Search by HS code to discover importers
   */
  async [JOB_TYPES.IMPORTYETI_SEARCH](job) {
    const { hsCode } = job.data;

    log.info(`Searching ImportYeti HS code: ${hsCode}`);
    job.updateProgress(10);

    await importYetiScraper.launch();
    try {
      const rawData = await importYetiScraper.searchByHSCode(hsCode);
      job.updateProgress(40);

      await saveRaw('shipments', 'importyeti', rawData, {
        jobId: job.id,
        query: `hs-${hsCode}`,
      });
      job.updateProgress(50);

      // Clean as buyer discovery leads
      const cleanedBuyers = rawData.importers.map((imp) =>
        cleanBuyerRecord({
          company_name: imp.company_name,
          country: imp.country,
          buyer_type: 'importer',
          _source: 'importyeti',
        })
      );
      const dedupedBuyers = dedup(cleanedBuyers, (r) => `${r.company_name}:${r.country}`);
      const validBuyers = filterIncomplete(dedupedBuyers, ['company_name'], 1);
      job.updateProgress(70);

      const buyerResult = await insertCompanies(validBuyers);
      job.updateProgress(100);

      return {
        source: 'importyeti',
        type: 'hs_code_search',
        hs_code: hsCode,
        raw_importers: rawData.importers.length,
        cleaned_buyers: validBuyers.length,
        inserted: buyerResult.inserted,
      };
    } finally {
      await importYetiScraper.close();
    }
  },


  async [JOB_TYPES.ZAUBA_SEARCH](job) {
    const { hsCodes, maxPages = 2 } = job.data;
    log.info(`Zauba: Starting fetch — ${(hsCodes || 'all').toString()}`);
    job.updateProgress(10);
    await zaubaScraper.launch();
    try {
      const targetCodes = hsCodes || ['4419','4420','7323','7013','6911','6912','7615','3924'];
      const allRaw = [];
      for (const hsCode of targetCodes) {
        for (let pg = 1; pg <= maxPages; pg++) {
          const result = await zaubaScraper.searchByHSCode(hsCode, pg);
          allRaw.push(...result.records.map(r => ({ ...r, hs_code: r.hs_code || hsCode })));
          if (!result.has_next) break;
          await new Promise(r => setTimeout(r, 4000));
        }
        await new Promise(r => setTimeout(r, 5000));
      }
      job.updateProgress(50);
      await saveRaw('shipments', 'zauba', allRaw, { jobId: job.id });
      job.updateProgress(60);
      const normalized = allRaw.map(r => ZaubaScraper.normalize(r)).filter(r => r.supplier_name_raw && r.ship_date);
      const deduped = dedup(normalized, r => `${r.supplier_name_raw}:${r.buyer_name_raw}:${r.ship_date}:${r.hs_code}`);
      job.updateProgress(75);
      const shipResult = await insertShipmentRecords(deduped);
      const exporters = [...new Set(deduped.map(r => r.supplier_name_raw).filter(Boolean))];
      const buyers    = [...new Set(deduped.map(r => r.buyer_name_raw).filter(Boolean))];
      await insertCompanies([
        ...exporters.map(name => ({ name, type: 'exporter', country: 'IND', source: 'zauba' })),
        ...buyers.map(name => ({ name, type: 'importer', country: null, source: 'zauba' })),
      ]);
      job.updateProgress(100);
      log.info(`Zauba complete: ${deduped.length} shipments, ${exporters.length} exporters, ${buyers.length} buyers`);
      return { source: 'zauba', raw_count: allRaw.length, normalized_count: deduped.length, exporters_found: exporters.length, buyers_found: buyers.length, inserted: shipResult.inserted || 0 };
    } finally {
      await zaubaScraper.close().catch(() => {});
    }
  },

};

export function startShipmentWorker() {
  const worker = new Worker(
    QUEUES.SHIPMENT,
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
      concurrency: 1, // Playwright — one browser at a time
      stalledInterval: 60000,
      drainDelay: 30,
    }
  );

  worker.on('completed', (job, result) => {
    log.info(`✓ Shipment job completed: ${job.name}`, { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    log.error(`✗ Shipment job failed: ${job?.name}`, { jobId: job?.id, error: err.message });
  });

  log.info('Shipment intelligence worker started');
  return worker;
}

export default { startShipmentWorker };
