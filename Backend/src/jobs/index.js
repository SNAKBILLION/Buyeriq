// ─────────────────────────────────────────────
// BuyerIQ — Background Jobs (Direct — No Redis)
// ─────────────────────────────────────────────
// Currency rates fetched every 5 minutes via
// direct setInterval — no BullMQ/Redis needed.
// ─────────────────────────────────────────────
import { fetchCurrencyRates } from './currencyJob.js';
import { logger } from '../config/logger.js';

export function initializeJobs() {
  // Fetch immediately on startup
  fetchCurrencyRates()
    .then(r => r?.success && logger.info(`Currency init: USD/INR ${r.usd_inr} from ${r.source}`))
    .catch(err => logger.warn(`Currency init failed: ${err.message}`));

  // Then every 5 minutes
  setInterval(() => {
    fetchCurrencyRates()
      .then(r => r?.success && logger.info(`Currency updated: USD/INR ${r.usd_inr} from ${r.source}`))
      .catch(err => logger.warn(`Currency fetch failed: ${err.message}`));
  }, 5 * 60 * 1000);

  logger.info('Background jobs initialized — direct interval (no Redis)');
}
