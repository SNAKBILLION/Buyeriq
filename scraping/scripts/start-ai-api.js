#!/usr/bin/env node
// ─────────────────────────────────────────────
// BuyerIQ — Start Intelligence API
// ─────────────────────────────────────────────
// Run: node scripts/start-ai-api.js
//      node scripts/start-ai-api.js --with-engine
//      node scripts/start-ai-api.js --port 5000
// ─────────────────────────────────────────────
import 'dotenv/config';
import cron from 'node-cron';
import { initAIEngine, runFullAnalysis } from '../src/ai-engine/index.js';
import { createAPIServer } from '../src/api/intelligence-api.js';
import { createLogger } from '../src/utils/logger.js';

const log = createLogger('ai-api');
const args = process.argv.slice(2);
const withEngine = args.includes('--with-engine');
const portArg = args.indexOf('--port');
const port = portArg >= 0 ? parseInt(args[portArg + 1]) : parseInt(process.env.PORT || process.env.AI_API_PORT || '4000');

async function start() {
  log.info('Starting BuyerIQ Intelligence API...');

  // Initialize AI tables
  await initAIEngine();

  // Start API server
  const { start: startServer } = createAPIServer(port);
  await startServer();

  // Optionally schedule AI engine runs
  if (withEngine) {
    log.info('Scheduling AI engine runs...');

    // Run full analysis every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      log.info('Scheduled AI analysis starting...');
      try {
        const results = await runFullAnalysis();
        log.info('Scheduled AI analysis complete', {
          duration: results.total_duration_ms,
        });
      } catch (err) {
        log.error('Scheduled AI analysis failed', { error: err.message });
      }
    }, { timezone: 'UTC' });

    // Run initial analysis on boot (after 10s delay)
    setTimeout(async () => {
      log.info('Running initial AI analysis...');
      try {
        await runFullAnalysis();
        log.info('Initial AI analysis complete');
      } catch (err) {
        log.error('Initial AI analysis failed', { error: err.message });
      }
    }, 10000);

    log.info('AI engine scheduled: every 6 hours + initial run in 10s');
  }

  log.info('Intelligence API ready');
}

process.on('SIGINT', () => { log.info('Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { log.info('Shutting down...'); process.exit(0); });

start().catch((err) => {
  log.error('Failed to start', { error: err.message });
  process.exit(1);
});
