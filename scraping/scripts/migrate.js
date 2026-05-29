#!/usr/bin/env node
// ─────────────────────────────────────────────
// BuyerIQ — Scraper Monitoring Migration
// ─────────────────────────────────────────────
// Creates: scraper_jobs, scraper_logs, scraper_metrics, pipeline_metrics
// Run: node scripts/migrate.js
// ─────────────────────────────────────────────
import 'dotenv/config';
import { query, pool } from '../src/config/database.js';
import { MONITORING_SCHEMA } from '../src/monitoring/job-tracker.js';
import { PIPELINE_METRICS_SCHEMA } from '../src/monitoring/pipeline-monitor.js';
import { AI_SCHEMA } from '../src/ai-engine/ai-schema.js';
import { createLogger } from '../src/utils/logger.js';

const log = createLogger('migrate');

async function migrate() {
  log.info('Running all migrations...');

  try {
    // Scraper monitoring tables
    await query(MONITORING_SCHEMA);
    log.info('✓ scraper_jobs table created/verified');
    log.info('✓ scraper_logs table created/verified');
    log.info('✓ scraper_metrics table created/verified');

    // Pipeline processing metrics table
    await query(PIPELINE_METRICS_SCHEMA);
    log.info('✓ pipeline_metrics table created/verified');

    // AI Intelligence tables
    await query(AI_SCHEMA);
    log.info('✓ buyer_signals table created/verified');
    log.info('✓ market_opportunities table created/verified');
    log.info('✓ demand_trends table created/verified');
    log.info('✓ intelligence_reports table created/verified');

    // Verify all tables
    const result = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'scraper_jobs', 'scraper_logs', 'scraper_metrics', 'pipeline_metrics',
          'buyer_signals', 'market_opportunities', 'demand_trends', 'intelligence_reports'
        )
      ORDER BY table_name
    `);

    log.info(`Verified ${result.rows.length}/8 tables:`);
    result.rows.forEach((row) => log.info(`  → ${row.table_name}`));

    if (result.rows.length < 8) {
      log.warn('Some tables may not have been created — check PostgreSQL logs');
    }

    log.info('Migration complete');
  } catch (err) {
    log.error('Migration failed', { error: err.message, stack: err.stack });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
