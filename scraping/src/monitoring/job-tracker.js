// ─────────────────────────────────────────────
// BuyerIQ — Scraper Job Monitoring
// ─────────────────────────────────────────────
// Tracks every job: status, runtime, retries,
// errors. Provides metrics for ops dashboard.
// ─────────────────────────────────────────────
import { query } from '../config/database.js';
import { getAllQueueStats } from '../queues/queue-factory.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('monitoring');

// ── SQL to create monitoring tables ──────────
export const MONITORING_SCHEMA = `
-- Scraper job runs
CREATE TABLE IF NOT EXISTS scraper_jobs (
  id              SERIAL PRIMARY KEY,
  job_id          VARCHAR(255) NOT NULL,
  queue_name      VARCHAR(100) NOT NULL,
  job_type        VARCHAR(100) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  source          VARCHAR(100),
  query_params    JSONB,
  result          JSONB,
  error_message   TEXT,
  attempts        INTEGER DEFAULT 0,
  runtime_ms      INTEGER,
  records_raw     INTEGER DEFAULT 0,
  records_cleaned INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraper_jobs_status ON scraper_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_queue ON scraper_jobs(queue_name);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_type ON scraper_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_created ON scraper_jobs(created_at);

-- Scraper system logs
CREATE TABLE IF NOT EXISTS scraper_logs (
  id              SERIAL PRIMARY KEY,
  level           VARCHAR(10) NOT NULL,
  source          VARCHAR(100),
  message         TEXT NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraper_logs_level ON scraper_logs(level);
CREATE INDEX IF NOT EXISTS idx_scraper_logs_source ON scraper_logs(source);
CREATE INDEX IF NOT EXISTS idx_scraper_logs_created ON scraper_logs(created_at);

-- Scraper metrics (aggregated, for dashboard)
CREATE TABLE IF NOT EXISTS scraper_metrics (
  id              SERIAL PRIMARY KEY,
  metric_date     DATE NOT NULL,
  queue_name      VARCHAR(100) NOT NULL,
  jobs_completed  INTEGER DEFAULT 0,
  jobs_failed     INTEGER DEFAULT 0,
  avg_runtime_ms  INTEGER DEFAULT 0,
  total_records   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date, queue_name)
);
`;

/**
 * Record a job's final outcome into scraper_jobs table
 */
export async function recordJobResult(job, status, result, runtimeMs) {
  try {
    await query(
      `INSERT INTO scraper_jobs
        (job_id, queue_name, job_type, status, source,
         query_params, result, error_message, attempts,
         runtime_ms, records_raw, records_cleaned, records_inserted,
         completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [
        job.id,
        job.queueName || job.queue?.name || 'unknown',
        job.name,
        status,
        result?.source || null,
        JSON.stringify(job.data || {}),
        JSON.stringify(result || {}),
        status === 'failed' ? result?.error || null : null,
        job.attemptsMade || 0,
        runtimeMs || 0,
        result?.raw_count || result?.raw_shipments || 0,
        result?.cleaned_count || result?.cleaned_products || result?.cleaned_shipments || 0,
        result?.inserted || result?.inserted_products || 0,
      ]
    );
  } catch (err) {
    // Monitoring should never crash a worker
    log.error('Failed to record job result', { jobId: job.id, error: err.message });
  }
}

/**
 * Write a structured log entry to scraper_logs
 */
export async function writeLog(level, source, message, metadata = {}) {
  try {
    await query(
      `INSERT INTO scraper_logs (level, source, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [level, source, message, JSON.stringify(metadata)]
    );
  } catch {
    // Silent fail — don't let logging crash anything
  }
}

/**
 * Get job metrics for a date range
 */
export async function getJobMetrics(daysBack = 7) {
  const result = await query(
    `SELECT
       queue_name,
       status,
       COUNT(*) as count,
       AVG(runtime_ms)::int as avg_runtime_ms,
       SUM(records_inserted) as total_inserted,
       MIN(started_at) as earliest,
       MAX(completed_at) as latest
     FROM scraper_jobs
     WHERE created_at > NOW() - INTERVAL '${daysBack} days'
     GROUP BY queue_name, status
     ORDER BY queue_name, status`
  );

  return result.rows;
}

/**
 * Get recent failed jobs for debugging
 */
export async function getFailedJobs(limit = 20) {
  const result = await query(
    `SELECT job_id, queue_name, job_type, error_message,
            attempts, runtime_ms, query_params, created_at
     FROM scraper_jobs
     WHERE status = 'failed'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

/**
 * Get overall system health snapshot
 */
export async function getSystemHealth() {
  // Queue stats (live from Redis)
  let queueStats = {};
  try {
    queueStats = await getAllQueueStats();
  } catch {
    queueStats = { error: 'Redis unavailable' };
  }

  // DB job stats (last 24h)
  const jobStats = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed') as completed_24h,
       COUNT(*) FILTER (WHERE status = 'failed') as failed_24h,
       AVG(runtime_ms) FILTER (WHERE status = 'completed')::int as avg_runtime_24h,
       SUM(records_inserted) FILTER (WHERE status = 'completed') as records_24h
     FROM scraper_jobs
     WHERE created_at > NOW() - INTERVAL '24 hours'`
  );

  // Table counts
  const tableCounts = await query(
    `SELECT
       (SELECT COUNT(*) FROM trade_statistics) as trade_stats,
       (SELECT COUNT(*) FROM shipment_records) as shipments,
       (SELECT COUNT(*) FROM retail_product_data) as retail_products,
       (SELECT COUNT(*) FROM suppliers) as suppliers,
       (SELECT COUNT(*) FROM companies) as companies,
       (SELECT COUNT(*) FROM price_data) as prices`
  ).catch(() => ({ rows: [{}] }));

  return {
    queues: queueStats,
    jobs_24h: jobStats.rows[0],
    database: tableCounts.rows[0],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Update daily aggregated metrics
 */
export async function updateDailyMetrics() {
  try {
    await query(
      `INSERT INTO scraper_metrics (metric_date, queue_name, jobs_completed, jobs_failed, avg_runtime_ms, total_records)
       SELECT
         DATE(created_at) as metric_date,
         queue_name,
         COUNT(*) FILTER (WHERE status = 'completed'),
         COUNT(*) FILTER (WHERE status = 'failed'),
         AVG(runtime_ms) FILTER (WHERE status = 'completed')::int,
         SUM(records_inserted) FILTER (WHERE status = 'completed')
       FROM scraper_jobs
       WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
       GROUP BY DATE(created_at), queue_name
       ON CONFLICT (metric_date, queue_name) DO UPDATE SET
         jobs_completed = EXCLUDED.jobs_completed,
         jobs_failed = EXCLUDED.jobs_failed,
         avg_runtime_ms = EXCLUDED.avg_runtime_ms,
         total_records = EXCLUDED.total_records`
    );
    log.info('Daily metrics updated');
  } catch (err) {
    log.error('Failed to update daily metrics', { error: err.message });
  }
}

/**
 * Initialize monitoring tables
 */
export async function initMonitoring() {
  try {
    await query(MONITORING_SCHEMA);
    log.info('Monitoring tables initialized');
  } catch (err) {
    log.error('Failed to initialize monitoring tables', { error: err.message });
  }
}

export default {
  recordJobResult, writeLog, getJobMetrics, getFailedJobs,
  getSystemHealth, updateDailyMetrics, initMonitoring, MONITORING_SCHEMA,
};
