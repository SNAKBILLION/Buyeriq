#!/usr/bin/env node
// ─────────────────────────────────────────────
// BuyerIQ — Run AI Intelligence Cycle
// ─────────────────────────────────────────────
// Run: node scripts/run-ai-engine.js
//      node scripts/run-ai-engine.js --buyers-only
//      node scripts/run-ai-engine.js --opportunities-only
// ─────────────────────────────────────────────
import 'dotenv/config';
import { initAIEngine, runFullAnalysis } from '../src/ai-engine/index.js';
import { createLogger } from '../src/utils/logger.js';
import { pool } from '../src/config/database.js';

const log = createLogger('ai-runner');
const args = process.argv.slice(2);

async function run() {
  log.info('═══ BuyerIQ AI Intelligence Engine ═══');

  await initAIEngine();

  const options = {
    buyerDiscovery: !args.includes('--no-buyers'),
    shipmentAnalysis: !args.includes('--no-shipments'),
    demandDetection: !args.includes('--no-demand'),
    opportunities: !args.includes('--no-opportunities'),
    insights: !args.includes('--no-insights'),
  };

  // Single-engine overrides
  if (args.includes('--buyers-only')) {
    Object.keys(options).forEach((k) => (options[k] = false));
    options.buyerDiscovery = true;
  }
  if (args.includes('--opportunities-only')) {
    Object.keys(options).forEach((k) => (options[k] = false));
    options.opportunities = true;
    options.insights = true;
  }
  if (args.includes('--demand-only')) {
    Object.keys(options).forEach((k) => (options[k] = false));
    options.demandDetection = true;
  }

  const results = await runFullAnalysis(options);

  log.info('═══ Results ═══');
  console.log(JSON.stringify(results, null, 2));

  await pool.end();
  process.exit(0);
}

run().catch((err) => {
  log.error('AI engine failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
