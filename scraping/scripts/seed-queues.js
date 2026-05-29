#!/usr/bin/env node
// ─────────────────────────────────────────────
// BuyerIQ — Seed Queues with Initial Jobs
// ─────────────────────────────────────────────
// Run: node scripts/seed-queues.js
// Seeds all queues with a first batch of jobs
// for initial data population.
// ─────────────────────────────────────────────
import 'dotenv/config';
import { addJob, initializeQueues, closeAllQueues } from '../src/queues/queue-factory.js';
import { QUEUES, JOB_TYPES, TARGET_HS_CODES, MARKETPLACE_KEYWORDS, SUPPLIER_KEYWORDS, PRIORITY_MARKETS } from '../src/config/constants.js';
import { createLogger } from '../src/utils/logger.js';

const log = createLogger('seed');

async function seed() {
  log.info('═══ BuyerIQ Queue Seeder ═══');
  initializeQueues();

  let total = 0;

  // ── 1. Trade Data (COMTRADE) ────────────────
  log.info('Seeding trade data jobs...');
  const currentYear = new Date().getFullYear();

  // India exports (last 3 years)
  for (let y = currentYear - 3; y < currentYear; y++) {
    await addJob(QUEUES.TRADE_DATA, JOB_TYPES.COMTRADE_FETCH, { year: y });
    total++;
  }

  // US imports
  await addJob(QUEUES.TRADE_DATA, JOB_TYPES.USITC_FETCH, { year: currentYear - 1 });
  total++;

  // Bilateral — top 5 markets
  for (const market of PRIORITY_MARKETS.slice(0, 5)) {
    await addJob(QUEUES.TRADE_DATA, JOB_TYPES.COMTRADE_BILATERAL, {
      partnerCode: market.code,
      yearStart: currentYear - 5,
      yearEnd: currentYear - 1,
    });
    total++;
  }

  // Currency
  await addJob(QUEUES.TRADE_DATA, JOB_TYPES.CURRENCY_UPDATE, {});
  total++;

  // ── 2. Shipment Intelligence ────────────────
  log.info('Seeding shipment intelligence jobs...');

  const targetBuyers = [
    'CRATE AND BARREL', 'WILLIAMS SONOMA', 'TARGET CORPORATION',
    'IKEA SUPPLY', 'POTTERY BARN', 'BED BATH BEYOND',
  ];

  for (const buyer of targetBuyers) {
    await addJob(QUEUES.SHIPMENT, JOB_TYPES.IMPORTYETI_COMPANY, { companyName: buyer });
    total++;
  }

  for (const hs of TARGET_HS_CODES.slice(0, 2)) {
    await addJob(QUEUES.SHIPMENT, JOB_TYPES.IMPORTYETI_SEARCH, { hsCode: hs });
    total++;
  }

  // ── 3. Marketplace Intelligence ─────────────
  log.info('Seeding marketplace intelligence jobs...');

  for (const keyword of MARKETPLACE_KEYWORDS.slice(0, 5)) {
    await addJob(QUEUES.MARKETPLACE, JOB_TYPES.AMAZON_SEARCH, { keyword, maxPages: 2 });
    total++;
    await addJob(QUEUES.MARKETPLACE, JOB_TYPES.WALMART_SEARCH, { keyword, maxPages: 1 });
    total++;
  }

  // ── 4. Supplier Discovery ──────────────────
  log.info('Seeding supplier discovery jobs...');

  for (const keyword of SUPPLIER_KEYWORDS.slice(0, 4)) {
    await addJob(QUEUES.SUPPLIER, JOB_TYPES.ALIBABA_SEARCH, { keyword, maxPages: 2 });
    total++;
  }

  // ── 5. Buyer Discovery ─────────────────────
  log.info('Seeding buyer discovery jobs...');

  await addJob(QUEUES.BUYER_DISCOVERY, JOB_TYPES.BUYER_PROCUREMENT_SCAN, { hsCode: '4419' });
  total++;
  await addJob(QUEUES.BUYER_DISCOVERY, JOB_TYPES.BUYER_PROCUREMENT_SCAN, { keyword: 'wooden kitchenware importer' });
  total++;

  log.info(`═══ Seeding complete: ${total} jobs queued ═══`);

  await closeAllQueues();
  process.exit(0);
}

seed().catch((err) => {
  log.error('Seed failed', { error: err.message });
  process.exit(1);
});
