// ─────────────────────────────────────────────
// BuyerIQ — AI Engine Orchestrator
// ─────────────────────────────────────────────
// Runs all AI intelligence engines in sequence:
//  1. Buyer Discovery
//  2. Shipment Analysis
//  3. Demand Detection
//  4. Market Opportunity
//  5. Insight Generation
//
// Can be triggered manually, via cron, or API.
// ─────────────────────────────────────────────
import { query } from '../config/database.js';
import { createLogger } from '../utils/logger.js';
import { migrateAISchema } from './ai-schema.js';
import { runBuyerDiscovery, getBuyerSignals, getBuyerSignalStats } from './buyer-discovery.js';
import { runShipmentAnalysis, getShipmentTrends } from './shipment-analysis.js';
import { runDemandDetection, getDemandTrends } from './demand-detection.js';
import { runOpportunityDetection, getOpportunities } from './market-opportunity.js';
import { generateInsights, getInsights, markInsightRead, getInsightStats } from './insight-generator.js';

const log = createLogger('ai:orchestrator');

/**
 * Run the complete AI intelligence cycle.
 * This is the main entry point — runs all engines in order.
 *
 * @param {object} options
 * @param {boolean} options.buyerDiscovery - Run buyer discovery
 * @param {boolean} options.shipmentAnalysis - Run shipment analysis
 * @param {boolean} options.demandDetection - Run demand detection
 * @param {boolean} options.opportunities - Run opportunity detection
 * @param {boolean} options.insights - Generate insight reports
 * @returns {object} Combined results from all engines
 */
export async function runFullAnalysis(options = {}) {
  const {
    buyerDiscovery = true,
    shipmentAnalysis = true,
    demandDetection = true,
    opportunities = true,
    insights = true,
  } = options;

  const startTime = Date.now();
  log.info('══════════════════════════════════════');
  log.info('  AI Intelligence Cycle Starting');
  log.info('══════════════════════════════════════');

  const results = {};

  // ── Stage 1: Buyer Discovery ───────────
  if (buyerDiscovery) {
    try {
      results.buyer_discovery = await runBuyerDiscovery();
      log.info(`✓ Buyer Discovery: ${results.buyer_discovery.total_signals} signals`);
    } catch (err) {
      log.error('✗ Buyer Discovery failed', { error: err.message });
      results.buyer_discovery = { error: err.message };
    }
  }

  // ── Stage 2: Shipment Analysis ─────────
  if (shipmentAnalysis) {
    try {
      results.shipment_analysis = await runShipmentAnalysis();
      log.info(`✓ Shipment Analysis: ${results.shipment_analysis.route_analysis?.length || 0} routes`);
    } catch (err) {
      log.error('✗ Shipment Analysis failed', { error: err.message });
      results.shipment_analysis = { error: err.message };
    }
  }

  // ── Stage 3: Demand Detection ──────────
  if (demandDetection) {
    try {
      results.demand_detection = await runDemandDetection();
      log.info(`✓ Demand Detection: ${results.demand_detection.total_trends} trends`);
    } catch (err) {
      log.error('✗ Demand Detection failed', { error: err.message });
      results.demand_detection = { error: err.message };
    }
  }

  // ── Stage 4: Opportunity Detection ─────
  if (opportunities) {
    try {
      results.opportunities = await runOpportunityDetection();
      log.info(`✓ Opportunities: ${results.opportunities.total_opportunities} found, ${results.opportunities.high_score} high-score`);
    } catch (err) {
      log.error('✗ Opportunity Detection failed', { error: err.message });
      results.opportunities = { error: err.message };
    }
  }

  // ── Stage 5: Insight Generation ────────
  if (insights) {
    try {
      results.insights = await generateInsights();
      log.info(`✓ Insights: ${results.insights.total_reports} reports generated`);
    } catch (err) {
      log.error('✗ Insight Generation failed', { error: err.message });
      results.insights = { error: err.message };
    }
  }

  const totalDuration = Date.now() - startTime;
  log.info('══════════════════════════════════════');
  log.info(`  AI Cycle Complete: ${totalDuration}ms`);
  log.info('══════════════════════════════════════');

  results.total_duration_ms = totalDuration;
  results.completed_at = new Date().toISOString();

  return results;
}

/**
 * Initialize AI engine (migrate tables)
 */
export async function initAIEngine() {
  log.info('Initializing AI intelligence engine...');
  const ok = await migrateAISchema();
  if (ok) log.info('✓ AI engine initialized');
  return ok;
}

/**
 * Get combined AI health/stats snapshot
 */
export async function getAIHealthSnapshot() {
  const [buyerStats, insightStats, tableStats] = await Promise.all([
    getBuyerSignalStats().catch(() => []),
    getInsightStats().catch(() => []),
    query(`
      SELECT
        (SELECT COUNT(*) FROM buyer_signals WHERE is_active = TRUE) AS active_buyer_signals,
        (SELECT COUNT(*) FROM market_opportunities WHERE is_active = TRUE) AS active_opportunities,
        (SELECT COUNT(*) FROM demand_trends WHERE is_active = TRUE) AS active_demand_trends,
        (SELECT COUNT(*) FROM intelligence_reports WHERE is_active = TRUE) AS active_reports,
        (SELECT COUNT(*) FROM intelligence_reports WHERE is_active = TRUE AND is_read = FALSE) AS unread_reports,
        (SELECT MAX(detected_at) FROM buyer_signals) AS last_buyer_scan,
        (SELECT MAX(detected_at) FROM market_opportunities) AS last_opportunity_scan,
        (SELECT MAX(detected_at) FROM intelligence_reports) AS last_insight_gen
    `).then((r) => r.rows[0]).catch(() => ({})),
  ]);

  return {
    tables: tableStats,
    buyer_signal_breakdown: buyerStats,
    insight_breakdown: insightStats,
    timestamp: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════
// RE-EXPORTS (for API routes)
// ══════════════════════════════════════════════

export {
  // Buyer
  getBuyerSignals, getBuyerSignalStats,
  // Shipments
  getShipmentTrends,
  // Demand
  getDemandTrends,
  // Opportunities
  getOpportunities,
  // Insights
  getInsights, markInsightRead, getInsightStats,
};

export default {
  runFullAnalysis, initAIEngine, getAIHealthSnapshot,
  getBuyerSignals, getBuyerSignalStats,
  getShipmentTrends,
  getDemandTrends,
  getOpportunities,
  getInsights, markInsightRead, getInsightStats,
};
