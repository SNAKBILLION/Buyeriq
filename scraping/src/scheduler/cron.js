// ─────────────────────────────────────────────
// BuyerIQ — Job Scheduler (Direct — No Redis)
// ─────────────────────────────────────────────
// Marketplace scraping = manual batch (run-batch-scrape.js)
// Cron only handles:
// ┌─── Currency       → every hour at :05
// └─── Raw cleanup    → Saturday 23:30 UTC
// ─────────────────────────────────────────────
import cron from 'node-cron';
import { createLogger } from '../utils/logger.js';
import { cleanupOldData } from '../pipeline/raw-storage.js';

const log = createLogger('scheduler');
const scheduledJobs = [];

// ── Lazy imports ──────────────────────────────
async function getFrankfurter() { const { frankfurterConnector } = await import('../connectors/api/frankfurter.connector.js'); return frankfurterConnector; }

// ── Helper: run safely ────────────────────────
async function runScraper(name, fn) {
  try {
    log.info(`Cron: ${name} starting`);
    await fn();
    log.info(`Cron: ${name} complete`);
  } catch (err) {
    log.error(`Cron: ${name} failed — ${err.message}`);
  }
}

export function startScheduler() {
  log.info('Starting scheduler (direct — no Redis)...');

  // ── HOURLY: Currency Rates (:05) ──────────
  schedule('5 * * * *', 'currency-update', async () => {
    const fx = await getFrankfurter();
    const rates = await fx.getLatestRates('USD');
    log.info(`Currency updated: USD/INR ${rates?.rates?.INR}`);
  });

  // ── WEEKLY: Raw Data Cleanup (Saturday 23:30 UTC) ──
  schedule('30 23 * * 6', 'raw-cleanup-weekly', async () => {
    const retentionDays = parseInt(process.env.RAW_DATA_RETENTION_DAYS || '30', 10);
    await cleanupOldData(retentionDays);
    log.info(`Raw data cleanup: ${retentionDays} day retention`);
  });


  // ── WEEKLY: AI Intelligence Cycle (Sunday 01:00 UTC) ──
  schedule('0 1 * * 0', 'ai-intelligence-weekly', async () => {
    await runScraper('ai-intelligence-weekly', async () => {
      const { runFullAnalysis, initAIEngine } = await import('../ai-engine/index.js');
      await initAIEngine();
      await runFullAnalysis({ opportunities: true, insights: true, demandDetection: true, buyerDiscovery: false, shipmentAnalysis: false });
      log.info('AI intelligence weekly cycle complete');
    });
  });
  log.info(`Scheduler started — ${scheduledJobs.length} jobs registered`);
}

function schedule(pattern, name, fn) {
  const task = cron.schedule(pattern, async () => {
    log.info(`Cron firing: ${name}`);
    try {
      await fn();
    } catch (err) {
      log.error(`Cron failed: ${name} — ${err.message}`);
    }
  }, { timezone: 'UTC' });

  scheduledJobs.push({ name, pattern, task });
  log.debug(`Scheduled: ${name} → ${pattern}`);
}

export function stopScheduler() {
  scheduledJobs.forEach(({ name, task }) => {
    task.stop();
    log.debug(`Stopped: ${name}`);
  });
  scheduledJobs.length = 0;
  log.info('Scheduler stopped');
}

export function listSchedules() {
  return scheduledJobs.map(({ name, pattern }) => ({ name, pattern }));
}

export default { startScheduler, stopScheduler, listSchedules };
