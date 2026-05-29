#!/usr/bin/env node
// ─────────────────────────────────────────────
// BuyerIQ — Connector Smoke Test
// ─────────────────────────────────────────────
// Run: node scripts/test-connector.js <name>
// Tests: comtrade | frankfurter | amazon |
//        walmart | importyeti | alibaba
// ─────────────────────────────────────────────
import 'dotenv/config';
import { createLogger } from '../src/utils/logger.js';

const log = createLogger('test');
const connector = process.argv[2];

if (!connector) {
  console.log('Usage: node scripts/test-connector.js <connector>');
  console.log('Available: comtrade, frankfurter, amazon, walmart, importyeti, alibaba, census');
  process.exit(1);
}

const tests = {
  async census() {
    const { CensusConnector } = await import('../src/connectors/api/census.connector.js');
    const c = new CensusConnector();
    const data = await c.fetchImportsByHS('4419', 2023);
    console.log('Census records:', data.length);
    console.log('Sample:', JSON.stringify(data[0], null, 2));
  },

  async comtrade() {
    const { comtradeConnector } = await import('../src/connectors/api/comtrade.connector.js');
    log.info('Testing COMTRADE API...');
    const data = await comtradeConnector.getIndiaExports(2023);
    log.info(`✓ COMTRADE returned ${data.length} records`);
    if (data.length > 0) {
      log.info('Sample record:', JSON.stringify(data[0], null, 2).substring(0, 300));
    }
    return data;
  },

  async frankfurter() {
    const { frankfurterConnector } = await import('../src/connectors/api/frankfurter.connector.js');
    log.info('Testing Frankfurter API...');
    const rates = await frankfurterConnector.getLatestRates('USD');
    log.info(`✓ Frankfurter returned rates for ${Object.keys(rates.rates).length} currencies`);
    log.info(`  USD/INR: ${rates.rates.INR}`);
    log.info(`  USD/EUR: ${rates.rates.EUR}`);
    log.info(`  Date: ${rates.date}`);
    return rates;
  },

  async amazon() {
    const { amazonScraper } = await import('../src/connectors/scrapers/amazon.scraper.js');
    log.info('Testing Amazon scraper...');
    await amazonScraper.launch();
    try {
      const products = await amazonScraper.searchProducts('wooden cutting board', 1);
      log.info(`✓ Amazon returned ${products.length} products`);
      if (products.length > 0) {
        const p = products[0];
        log.info(`  First: "${p.title?.substring(0, 60)}..." $${p.price} ★${p.rating}`);
      }
      return products;
    } finally {
      await amazonScraper.close();
    }
  },

  async walmart() {
    const { walmartScraper } = await import('../src/connectors/scrapers/walmart.scraper.js');
    log.info('Testing Walmart scraper...');
    await walmartScraper.launch();
    try {
      const products = await walmartScraper.searchProducts('wooden cutting board', 1);
      log.info(`✓ Walmart returned ${products.length} products`);
      if (products.length > 0) {
        const p = products[0];
        log.info(`  First: "${p.title?.substring(0, 60)}..." $${p.price}`);
      }
      return products;
    } finally {
      await walmartScraper.close();
    }
  },

  async importyeti() {
    const { importYetiScraper } = await import('../src/connectors/scrapers/importyeti.scraper.js');
    log.info('Testing ImportYeti scraper...');
    await importYetiScraper.launch();
    try {
      const data = await importYetiScraper.searchByHSCode('4419');
      log.info(`✓ ImportYeti HS 4419: ${data.importers?.length || 0} importers found`);
      if (data.importers?.length > 0) {
        log.info(`  First: ${data.importers[0].company_name} (${data.importers[0].country})`);
      }
      return data;
    } finally {
      await importYetiScraper.close();
    }
  },

  async alibaba() {
    const { alibabaScraper } = await import('../src/connectors/scrapers/alibaba.scraper.js');
    log.info('Testing Alibaba scraper...');
    await alibabaScraper.launch();
    try {
      const results = await alibabaScraper.searchSuppliers('wooden cutting board manufacturer', 1);
      log.info(`✓ Alibaba returned ${results.length} listings`);
      if (results.length > 0) {
        const s = results[0];
        log.info(`  First: "${s.title?.substring(0, 50)}..." by ${s.supplier_name} (${s.location})`);
      }
      return results;
    } finally {
      await alibabaScraper.close();
    }
  },
};

async function runTest() {
  if (!tests[connector]) {
    log.error(`Unknown connector: ${connector}`);
    console.log('Available:', Object.keys(tests).join(', '));
    process.exit(1);
  }

  try {
    const startTime = Date.now();
    await tests[connector]();
    log.info(`Test completed in ${Date.now() - startTime}ms`);
  } catch (err) {
    log.error(`Test failed: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }

  process.exit(0);
}

runTest();
