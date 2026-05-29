// ─────────────────────────────────────────────
// BuyerIQ — Marketplace Intelligence Worker
// ─────────────────────────────────────────────
// Processes: marketplace_scraper_queue
// Sources:  Amazon, Walmart, Wayfair, Etsy
// Pipeline: Scrape → Raw → Clean → DB
// ─────────────────────────────────────────────
import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { QUEUES, JOB_TYPES } from '../config/constants.js';
import { amazonScraper } from '../connectors/scrapers/amazon.scraper.js';
import { walmartScraper } from '../connectors/scrapers/walmart.scraper.js';
import { amazonUKScraper } from '../connectors/scrapers/amazon-uk.scraper.js';
import { amazonDEScraper } from '../connectors/scrapers/amazon-de.scraper.js';
import { indiaMartScraper } from '../connectors/scrapers/indiamart.scraper.js';
import { madeInChinaScraper } from '../connectors/scrapers/made-in-china.scraper.js';
import { saveRaw } from '../pipeline/raw-storage.js';
import { cleanRetailProduct, cleanPriceRecord, dedup, filterIncomplete } from '../pipeline/cleaner.js';
import { insertRetailProducts, insertPriceData, insertSuppliers } from '../pipeline/db-inserter.js';
import { recordJobResult } from '../monitoring/job-tracker.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('worker:marketplace');

const handlers = {
  /**
   * Amazon product search + price extraction
   */
  async [JOB_TYPES.AMAZON_SEARCH](job) {
    const { keyword, maxPages = 2 } = job.data;

    log.info(`Scraping Amazon for: ${keyword}`);
    job.updateProgress(10);

    await amazonScraper.launch();
    try {
      const rawProducts = await amazonScraper.searchProducts(keyword, maxPages);
      job.updateProgress(40);

      await saveRaw('marketplace', 'amazon', rawProducts, {
        jobId: job.id,
        query: keyword,
      });
      job.updateProgress(50);

      // Clean as retail products
      const cleanedProducts = rawProducts.map(cleanRetailProduct);
      const dedupedProducts = dedup(cleanedProducts, (r) => r.asin || r.product_url || r.product_name);
      const validProducts = filterIncomplete(dedupedProducts, ['product_name', 'price'], 2);
      job.updateProgress(70);

      // Extract price data for price intelligence
      const priceRecords = validProducts
        .filter((p) => p.price)
        .map((p) => cleanPriceRecord({
          product_type: 'wood_kitchenware',
          price_usd: p.price,
          price_type: 'retail',
          source_platform: 'amazon',
          source_url: p.product_url,
          currency: 'USD',
          price_original: p.price,
          _source: 'amazon',
        }));

      const productResult = await insertRetailProducts(validProducts);
      const priceResult = await insertPriceData(priceRecords);
      job.updateProgress(100);

      return {
        source: 'amazon',
        keyword,
        raw_count: rawProducts.length,
        cleaned_products: validProducts.length,
        inserted_products: productResult.inserted,
        inserted_prices: priceResult.inserted,
      };
    } finally {
      await amazonScraper.close();
    }
  },

  /**
   * Amazon detailed product page (single ASIN)
   */
  async [JOB_TYPES.AMAZON_PRODUCT](job) {
    const { asin } = job.data;

    log.info(`Scraping Amazon product: ${asin}`);

    await amazonScraper.launch();
    try {
      const rawProduct = await amazonScraper.getProductDetail(asin);

      await saveRaw('marketplace', 'amazon', rawProduct, {
        jobId: job.id,
        query: asin,
      });

      const cleaned = cleanRetailProduct(rawProduct);
      const productResult = await insertRetailProducts([cleaned]);

      if (cleaned.price) {
        const priceRecord = cleanPriceRecord({
          product_type: 'wood_kitchenware',
          price_usd: cleaned.price,
          price_type: 'retail',
          source_platform: 'amazon',
          source_url: cleaned.product_url,
          currency: 'USD',
          _source: 'amazon',
        });
        await insertPriceData([priceRecord]);
      }

      return {
        source: 'amazon',
        asin,
        inserted: productResult.inserted,
      };
    } finally {
      await amazonScraper.close();
    }
  },

  /**
   * Walmart product search
   */
  
  async [JOB_TYPES.AMAZON_UK_SEARCH](job) {
    const { keyword, maxPages = 2 } = job.data;
    log.info(`Scraping Amazon UK for: ${keyword}`);
    job.updateProgress(10);
    await amazonUKScraper.launch();
    try {
      const rawProducts = await amazonUKScraper.searchProducts(keyword, maxPages);
      job.updateProgress(40);
      await saveRaw('marketplace', 'amazon_uk', rawProducts, { jobId: job.id, query: keyword });
      job.updateProgress(50);
      const cleanedProducts = rawProducts.map(cleanRetailProduct);
      const validProducts = filterIncomplete(dedup(cleanedProducts, r => r.product_url || r.product_name), ['product_name', 'price'], 2);
      const priceRecords = validProducts.filter(p => p.price).map(p => cleanPriceRecord({
        product_type: 'kitchenware', price_usd: p.price, price_type: 'retail',
        source_platform: 'amazon_uk', source_url: p.product_url, currency: 'GBP', _source: 'amazon_uk',
      }));
      const productResult = await insertRetailProducts(validProducts);
      const priceResult = await insertPriceData(priceRecords);
      job.updateProgress(100);
      return { source: 'amazon_uk', keyword, raw_count: rawProducts.length, inserted_products: productResult.inserted, inserted_prices: priceResult.inserted };
    } finally {
      await amazonUKScraper.close();
    }
  },

  async [JOB_TYPES.AMAZON_DE_SEARCH](job) {
    const { keyword, maxPages = 2 } = job.data;
    log.info(`Scraping Amazon DE for: ${keyword}`);
    job.updateProgress(10);
    await amazonDEScraper.launch();
    try {
      const rawProducts = await amazonDEScraper.searchProducts(keyword, maxPages);
      job.updateProgress(40);
      await saveRaw('marketplace', 'amazon_de', rawProducts, { jobId: job.id, query: keyword });
      job.updateProgress(50);
      const cleanedProducts = rawProducts.map(cleanRetailProduct);
      const validProducts = filterIncomplete(dedup(cleanedProducts, r => r.product_url || r.product_name), ['product_name', 'price'], 2);
      const priceRecords = validProducts.filter(p => p.price).map(p => cleanPriceRecord({
        product_type: 'kitchenware', price_usd: p.price, price_type: 'retail',
        source_platform: 'amazon_de', source_url: p.product_url, currency: 'EUR', _source: 'amazon_de',
      }));
      const productResult = await insertRetailProducts(validProducts);
      const priceResult = await insertPriceData(priceRecords);
      job.updateProgress(100);
      return { source: 'amazon_de', keyword, raw_count: rawProducts.length, inserted_products: productResult.inserted, inserted_prices: priceResult.inserted };
    } finally {
      await amazonDEScraper.close();
    }
  },

  async [JOB_TYPES.INDIAMART_SEARCH](job) {
    const { keyword } = job.data;
    log.info(`Scraping IndiaMART for: ${keyword}`);
    job.updateProgress(10);
    await indiaMartScraper.launch();
    try {
      const suppliers = await indiaMartScraper.searchSuppliers(keyword, 2);
      job.updateProgress(60);
      await saveRaw('marketplace', 'indiamart', suppliers, { jobId: job.id, query: keyword });
      job.updateProgress(75);

      // Fix: Insert into suppliers table
      const cleaned = suppliers.map(s => ({
        name: s.company_name,
        country_code: 'IND',
        city: s.location,
        product_categories: s.products ? [s.products] : [],
        source_platform: 'indiamart',
        source_url: s.profile_url,
        confidence: 'industry_estimate',
      }));
      const result = await insertSuppliers(cleaned);
      job.updateProgress(100);

      return { source: 'indiamart', keyword, raw_count: suppliers.length, inserted: result.inserted };
    } finally {
      await indiaMartScraper.close();
    }
  },

  async [JOB_TYPES.MADE_IN_CHINA_SEARCH](job) {
    const { keyword } = job.data;
    log.info(`Scraping Made-in-China for: ${keyword}`);
    job.updateProgress(10);
    await madeInChinaScraper.launch();
    try {
      const products = await madeInChinaScraper.searchProducts(keyword, 2);
      job.updateProgress(40);
      await saveRaw('marketplace', 'made_in_china', products, { jobId: job.id, query: keyword });
      job.updateProgress(50);
      const cleanedProducts = products.map(cleanRetailProduct);
      const validProducts = filterIncomplete(dedup(cleanedProducts, r => r.product_url || r.product_name), ['product_name'], 1);
      const productResult = await insertRetailProducts(validProducts);
      job.updateProgress(100);
      return { source: 'made_in_china', keyword, raw_count: products.length, inserted_products: productResult.inserted };
    } finally {
      await madeInChinaScraper.close();
    }
  },
  async [JOB_TYPES.WALMART_SEARCH](job) {
    const { keyword, maxPages = 2 } = job.data;

    log.info(`Scraping Walmart for: ${keyword}`);
    job.updateProgress(10);

    await walmartScraper.launch();
    try {
      const rawProducts = await walmartScraper.searchProducts(keyword, maxPages);
      job.updateProgress(40);

      await saveRaw('marketplace', 'walmart', rawProducts, {
        jobId: job.id,
        query: keyword,
      });
      job.updateProgress(50);

      const cleanedProducts = rawProducts.map(cleanRetailProduct);
      const dedupedProducts = dedup(cleanedProducts, (r) => r.product_url || r.product_name);
      const validProducts = filterIncomplete(dedupedProducts, ['product_name', 'price'], 2);

      const priceRecords = validProducts
        .filter((p) => p.price)
        .map((p) => cleanPriceRecord({
          product_type: 'wood_kitchenware',
          price_usd: p.price,
          price_type: 'retail',
          source_platform: 'walmart',
          source_url: p.product_url,
          currency: 'USD',
          _source: 'walmart',
        }));

      const productResult = await insertRetailProducts(validProducts);
      const priceResult = await insertPriceData(priceRecords);
      job.updateProgress(100);

      return {
        source: 'walmart',
        keyword,
        raw_count: rawProducts.length,
        cleaned_products: validProducts.length,
        inserted_products: productResult.inserted,
        inserted_prices: priceResult.inserted,
      };
    } finally {
      await walmartScraper.close();
    }
  },
};

export function startMarketplaceWorker() {
  const worker = new Worker(
    QUEUES.MARKETPLACE,
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
    log.info(`✓ Marketplace job completed: ${job.name}`, { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    log.error(`✗ Marketplace job failed: ${job?.name}`, { jobId: job?.id, error: err.message });
  });

  log.info('Marketplace intelligence worker started');
  return worker;
}

export default { startMarketplaceWorker };
