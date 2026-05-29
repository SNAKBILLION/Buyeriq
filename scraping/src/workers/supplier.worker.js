// ─────────────────────────────────────────────
// BuyerIQ — Supplier Discovery Worker
// ─────────────────────────────────────────────
// Processes: supplier_scraper_queue
// Sources:  Alibaba, GlobalSources, IndiaMART
// Pipeline: Scrape → Raw → Clean → DB
// ─────────────────────────────────────────────
import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { QUEUES, JOB_TYPES } from '../config/constants.js';
import { alibabaScraper } from '../connectors/scrapers/alibaba.scraper.js';
import { saveRaw } from '../pipeline/raw-storage.js';
import { cleanSupplierRecord, dedup, filterIncomplete } from '../pipeline/cleaner.js';
import { insertSuppliers } from '../pipeline/db-inserter.js';
import { recordJobResult } from '../monitoring/job-tracker.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('worker:supplier');

const handlers = {
  /**
   * Alibaba supplier search by keyword
   */
  async [JOB_TYPES.ALIBABA_SEARCH](job) {
    const { keyword, maxPages = 2 } = job.data;

    log.info(`Scraping Alibaba for suppliers: ${keyword}`);
    job.updateProgress(10);

    await alibabaScraper.launch();
    try {
      const rawResults = await alibabaScraper.searchSuppliers(keyword, maxPages);
      job.updateProgress(40);

      await saveRaw('suppliers', 'alibaba', rawResults, {
        jobId: job.id,
        query: keyword,
      });
      job.updateProgress(50);

      // Clean into supplier records
      const cleaned = rawResults.map((r) =>
        cleanSupplierRecord({
          company_name: r.supplier_name,
          country: r.location,
          product_categories: [keyword],
          certifications: r.is_verified ? ['Trade Assurance'] : [],
          year_established: r.years_on_alibaba
            ? new Date().getFullYear() - r.years_on_alibaba
            : null,
          source_platform: 'alibaba',
          source_url: r.product_url,
          _source: 'alibaba',
        })
      );

      const deduped = dedup(cleaned, (r) => `${r.company_name}:${r.country}`);
      const valid = filterIncomplete(deduped, ['company_name'], 1);
      job.updateProgress(70);

      const result = await insertSuppliers(valid);
      job.updateProgress(100);

      return {
        source: 'alibaba',
        keyword,
        raw_count: rawResults.length,
        cleaned_count: valid.length,
        inserted: result.inserted,
      };
    } finally {
      await alibabaScraper.close();
    }
  },

  /**
   * GlobalSources supplier search (uses same scraper pattern)
   * Placeholder — will implement dedicated scraper in next iteration
   */
  async [JOB_TYPES.GLOBALSOURCES_SEARCH](job) {
    const { keyword } = job.data;
    log.info(`GlobalSources search: ${keyword} (stub — queued for implementation)`);

    return {
      source: 'globalsources',
      keyword,
      status: 'stub',
      message: 'GlobalSources scraper pending implementation — use Alibaba as primary',
    };
  },

  /**
   * IndiaMART supplier search (stub)
   */
  async [JOB_TYPES.INDIAMART_SEARCH](job) {
    const { keyword } = job.data;
    log.info(`IndiaMART search: ${keyword} (stub — queued for implementation)`);

    return {
      source: 'indiamart',
      keyword,
      status: 'stub',
      message: 'IndiaMART scraper pending implementation',
    };
  },
};

export function startSupplierWorker() {
  const worker = new Worker(
    QUEUES.SUPPLIER,
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
    log.info(`✓ Supplier job completed: ${job.name}`, { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    log.error(`✗ Supplier job failed: ${job?.name}`, { jobId: job?.id, error: err.message });
  });

  log.info('Supplier discovery worker started');
  return worker;
}

export default { startSupplierWorker };
