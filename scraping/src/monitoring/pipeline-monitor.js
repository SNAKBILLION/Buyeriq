// ─────────────────────────────────────────────
// BuyerIQ — Pipeline Processing Monitor
// ─────────────────────────────────────────────
// Tracks metrics for the data processing
// pipeline: records in/out, dedup stats,
// normalization stats, and runtime.
// ─────────────────────────────────────────────
import { query } from '../config/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('pipeline-monitor');

// ── Pipeline Metrics Table ───────────────────
export const PIPELINE_METRICS_SCHEMA = `
CREATE TABLE IF NOT EXISTS pipeline_metrics (
  id              SERIAL PRIMARY KEY,
  run_id          VARCHAR(100) NOT NULL,
  pipeline_stage  VARCHAR(50) NOT NULL,
  entity_type     VARCHAR(50),
  records_in      INTEGER DEFAULT 0,
  records_out     INTEGER DEFAULT 0,
  records_failed  INTEGER DEFAULT 0,
  duplicates_found INTEGER DEFAULT 0,
  entities_normalized INTEGER DEFAULT 0,
  hs_codes_mapped INTEGER DEFAULT 0,
  buyer_signals_detected INTEGER DEFAULT 0,
  suppliers_classified INTEGER DEFAULT 0,
  prices_analyzed INTEGER DEFAULT 0,
  avg_confidence  REAL DEFAULT 0,
  runtime_ms      INTEGER DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_run ON pipeline_metrics(run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_stage ON pipeline_metrics(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_created ON pipeline_metrics(created_at);
`;

/**
 * In-memory run tracker for a single pipeline execution.
 * Collects metrics across all stages, then flushes to DB.
 */
export class PipelineRun {
  constructor(runId, entityType) {
    this.runId = runId;
    this.entityType = entityType;
    this.startTime = Date.now();
    this.stages = [];
    this.currentStage = null;
  }

  /**
   * Start tracking a pipeline stage
   */
  beginStage(stageName) {
    this.currentStage = {
      pipeline_stage: stageName,
      entity_type: this.entityType,
      records_in: 0,
      records_out: 0,
      records_failed: 0,
      duplicates_found: 0,
      entities_normalized: 0,
      hs_codes_mapped: 0,
      buyer_signals_detected: 0,
      suppliers_classified: 0,
      prices_analyzed: 0,
      avg_confidence: 0,
      runtime_ms: 0,
      metadata: {},
      _startTime: Date.now(),
    };
    return this;
  }

  /**
   * Record metric for current stage
   */
  record(metrics) {
    if (!this.currentStage) return this;
    Object.assign(this.currentStage, metrics);
    return this;
  }

  /**
   * End current stage and push to stages list
   */
  endStage() {
    if (!this.currentStage) return this;
    this.currentStage.runtime_ms = Date.now() - this.currentStage._startTime;
    delete this.currentStage._startTime;
    this.stages.push(this.currentStage);

    log.info(`Pipeline stage [${this.currentStage.pipeline_stage}]`, {
      in: this.currentStage.records_in,
      out: this.currentStage.records_out,
      failed: this.currentStage.records_failed,
      dupes: this.currentStage.duplicates_found,
      ms: this.currentStage.runtime_ms,
    });

    this.currentStage = null;
    return this;
  }

  /**
   * Flush all stages to PostgreSQL
   */
  async flush() {
    const totalRuntime = Date.now() - this.startTime;

    for (const stage of this.stages) {
      try {
        await query(
          `INSERT INTO pipeline_metrics
            (run_id, pipeline_stage, entity_type, records_in, records_out,
             records_failed, duplicates_found, entities_normalized,
             hs_codes_mapped, buyer_signals_detected, suppliers_classified,
             prices_analyzed, avg_confidence, runtime_ms, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            this.runId, stage.pipeline_stage, stage.entity_type,
            stage.records_in, stage.records_out, stage.records_failed,
            stage.duplicates_found, stage.entities_normalized,
            stage.hs_codes_mapped, stage.buyer_signals_detected,
            stage.suppliers_classified, stage.prices_analyzed,
            stage.avg_confidence, stage.runtime_ms,
            JSON.stringify(stage.metadata),
          ]
        );
      } catch (err) {
        log.error(`Failed to flush pipeline metric: ${stage.pipeline_stage}`, { error: err.message });
      }
    }

    log.info(`Pipeline run [${this.runId}] complete`, {
      stages: this.stages.length,
      totalRuntime: totalRuntime,
      totalIn: this.stages.reduce((s, st) => s + st.records_in, 0),
      totalOut: this.stages.reduce((s, st) => s + st.records_out, 0),
    });

    return this.getSummary();
  }

  /**
   * Get run summary
   */
  getSummary() {
    return {
      runId: this.runId,
      entityType: this.entityType,
      totalRuntime: Date.now() - this.startTime,
      stages: this.stages.map((s) => ({
        stage: s.pipeline_stage,
        in: s.records_in,
        out: s.records_out,
        failed: s.records_failed,
        dupes: s.duplicates_found,
        ms: s.runtime_ms,
      })),
    };
  }
}

// ══════════════════════════════════════════════
// METRICS QUERIES
// ══════════════════════════════════════════════

/**
 * Get pipeline processing stats for last N days
 */
export async function getPipelineStats(daysBack = 7) {
  const result = await query(
    `SELECT
       pipeline_stage,
       entity_type,
       COUNT(*) as runs,
       SUM(records_in) as total_in,
       SUM(records_out) as total_out,
       SUM(records_failed) as total_failed,
       SUM(duplicates_found) as total_dupes,
       AVG(avg_confidence)::real as avg_confidence,
       AVG(runtime_ms)::int as avg_runtime_ms
     FROM pipeline_metrics
     WHERE created_at > NOW() - INTERVAL '${daysBack} days'
     GROUP BY pipeline_stage, entity_type
     ORDER BY pipeline_stage`
  );
  return result.rows;
}

/**
 * Get deduplication effectiveness
 */
export async function getDedupStats(daysBack = 30) {
  const result = await query(
    `SELECT
       entity_type,
       SUM(records_in) as total_in,
       SUM(duplicates_found) as total_dupes,
       CASE WHEN SUM(records_in) > 0
         THEN ROUND(SUM(duplicates_found)::numeric / SUM(records_in) * 100, 1)
         ELSE 0
       END as dedup_rate_pct
     FROM pipeline_metrics
     WHERE pipeline_stage = 'deduplication'
       AND created_at > NOW() - INTERVAL '${daysBack} days'
     GROUP BY entity_type
     ORDER BY dedup_rate_pct DESC`
  );
  return result.rows;
}

/**
 * Initialize pipeline monitoring tables
 */
export async function initPipelineMonitoring() {
  try {
    await query(PIPELINE_METRICS_SCHEMA);
    log.info('Pipeline monitoring tables initialized');
  } catch (err) {
    log.error('Failed to init pipeline monitoring', { error: err.message });
  }
}

export default {
  PipelineRun, getPipelineStats, getDedupStats, initPipelineMonitoring,
  PIPELINE_METRICS_SCHEMA,
};
