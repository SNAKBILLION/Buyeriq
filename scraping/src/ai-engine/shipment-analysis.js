// ─────────────────────────────────────────────
// BuyerIQ — AI Shipment Analysis Engine
// ─────────────────────────────────────────────
// Queries shipment_records to detect:
//  - import frequency patterns
//  - seasonal sourcing cycles
//  - supplier switching signals
//  - route concentration
//  - new importer detection
// ─────────────────────────────────────────────
import { query } from '../config/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ai:shipment-analysis');

/**
 * Run full shipment intelligence analysis
 */
export async function runShipmentAnalysis() {
  log.info('Running shipment analysis engine...');
  const startTime = Date.now();

  const [
    routeAnalysis,
    seasonalPatterns,
    supplierSwitching,
    concentrationRisks,
  ] = await Promise.all([
    analyzeTradeRoutes(),
    analyzeSeasonality(),
    detectSupplierSwitching(),
    analyzeSupplierConcentration(),
  ]);

  const duration = Date.now() - startTime;
  log.info(`Shipment analysis complete in ${duration}ms`);

  return {
    route_analysis: routeAnalysis,
    seasonal_patterns: seasonalPatterns,
    supplier_switching: supplierSwitching,
    concentration_risks: concentrationRisks,
    duration_ms: duration,
  };
}

// ══════════════════════════════════════════════
// TRADE ROUTE ANALYSIS
// ══════════════════════════════════════════════

/**
 * Analyze shipment volumes by origin → destination route
 */
async function analyzeTradeRoutes() {
  const result = await query(`
    SELECT
      origin_country,
      dest_country,
      COUNT(*) AS shipment_count,
      SUM(COALESCE(weight_kg, 0)) AS total_weight,
      SUM(COALESCE(estimated_value_usd, 0)) AS total_value,
      COUNT(DISTINCT buyer_name_raw) AS unique_importers,
      COUNT(DISTINCT supplier_name_raw) AS unique_exporters,
      AVG(CASE WHEN weight_kg > 0 THEN estimated_value_usd / weight_kg ELSE NULL END) AS avg_price_per_kg,
      MIN(ship_date) AS earliest,
      MAX(ship_date) AS latest
    FROM shipment_records
    WHERE origin_country IS NOT NULL AND dest_country IS NOT NULL
    GROUP BY origin_country, dest_country
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `);

  return result.rows.map((row) => ({
    route: `${row.origin_country} → ${row.dest_country}`,
    origin: row.origin_country,
    destination: row.dest_country,
    shipment_count: parseInt(row.shipment_count, 10),
    total_weight_kg: Math.round(parseFloat(row.total_weight || 0)),
    total_estimated_value_usd: Math.round(parseFloat(row.total_value || 0)),
    unique_importers: parseInt(row.unique_importers, 10),
    unique_exporters: parseInt(row.unique_exporters, 10),
    avg_price_per_kg: row.avg_price_per_kg ? Math.round(parseFloat(row.avg_price_per_kg) * 100) / 100 : null,
    period: { from: row.earliest, to: row.latest },
  }));
}

// ══════════════════════════════════════════════
// SEASONAL PATTERN DETECTION
// ══════════════════════════════════════════════

/**
 * Detect monthly/quarterly seasonality in shipments
 */
async function analyzeSeasonality() {
  const result = await query(`
    SELECT
      EXTRACT(MONTH FROM ship_date) AS month,
      EXTRACT(QUARTER FROM ship_date) AS quarter,
      COUNT(*) AS shipment_count,
      SUM(COALESCE(weight_kg, 0)) AS total_weight,
      SUM(COALESCE(estimated_value_usd, 0)) AS total_value,
      COUNT(DISTINCT buyer_name_raw) AS active_importers
    FROM shipment_records
    WHERE ship_date IS NOT NULL
      AND ship_date >= CURRENT_DATE - INTERVAL '2 years'
    GROUP BY EXTRACT(MONTH FROM ship_date), EXTRACT(QUARTER FROM ship_date)
    ORDER BY month
  `);

  if (result.rows.length === 0) return { monthly: [], peak_quarter: null, pattern: 'insufficient_data' };

  const monthly = result.rows.map((row) => ({
    month: parseInt(row.month, 10),
    quarter: parseInt(row.quarter, 10),
    shipment_count: parseInt(row.shipment_count, 10),
    total_weight: Math.round(parseFloat(row.total_weight || 0)),
    total_value: Math.round(parseFloat(row.total_value || 0)),
    active_importers: parseInt(row.active_importers, 10),
  }));

  // Find peak quarter
  const qMap = new Map();
  for (const m of monthly) {
    qMap.set(m.quarter, (qMap.get(m.quarter) || 0) + m.shipment_count);
  }
  const peakQ = [...qMap.entries()].sort((a, b) => b[1] - a[1])[0];

  // Detect pattern type
  const counts = monthly.map((m) => m.shipment_count);
  const avg = counts.reduce((s, c) => s + c, 0) / counts.length;
  const variance = counts.reduce((s, c) => s + (c - avg) ** 2, 0) / counts.length;
  const cv = avg > 0 ? Math.sqrt(variance) / avg : 0; // coefficient of variation

  const pattern = cv > 0.5 ? 'highly_seasonal' : cv > 0.25 ? 'moderately_seasonal' : 'stable';

  return {
    monthly,
    peak_quarter: peakQ ? `Q${peakQ[0]}` : null,
    pattern,
    coefficient_of_variation: Math.round(cv * 100) / 100,
  };
}

// ══════════════════════════════════════════════
// SUPPLIER SWITCHING DETECTION
// ══════════════════════════════════════════════

/**
 * Detect importers who are switching suppliers (opportunity for Senses)
 */
async function detectSupplierSwitching() {
  const result = await query(`
    WITH recent_suppliers AS (
      SELECT buyer_name_raw, dest_country,
             ARRAY_AGG(DISTINCT supplier_name_raw) AS recent_exporters,
             COUNT(DISTINCT supplier_name_raw) AS recent_count
      FROM shipment_records
      WHERE ship_date >= CURRENT_DATE - INTERVAL '6 months'
        AND buyer_name_raw IS NOT NULL AND supplier_name_raw IS NOT NULL
      GROUP BY buyer_name_raw, dest_country
    ),
    older_suppliers AS (
      SELECT buyer_name_raw, dest_country,
             ARRAY_AGG(DISTINCT supplier_name_raw) AS older_exporters,
             COUNT(DISTINCT supplier_name_raw) AS older_count
      FROM shipment_records
      WHERE ship_date < CURRENT_DATE - INTERVAL '6 months'
        AND ship_date >= CURRENT_DATE - INTERVAL '18 months'
        AND buyer_name_raw IS NOT NULL AND supplier_name_raw IS NOT NULL
      GROUP BY buyer_name_raw, dest_country
    )
    SELECT
      r.buyer_name_raw,
      r.dest_country,
      r.recent_exporters,
      r.recent_count,
      COALESCE(o.older_exporters, '{}') AS older_exporters,
      COALESCE(o.older_count, 0) AS older_count
    FROM recent_suppliers r
    LEFT JOIN older_suppliers o
      ON r.buyer_name_raw = o.buyer_name_raw
      AND r.dest_country = o.dest_country
    WHERE r.recent_count != COALESCE(o.older_count, 0)
       OR r.recent_exporters != COALESCE(o.older_exporters, '{}')
    ORDER BY r.recent_count DESC
    LIMIT 50
  `);

  return result.rows.map((row) => {
    const recent = Array.isArray(row.recent_exporters) ? row.recent_exporters : [];
    const older = Array.isArray(row.older_exporters) ? row.older_exporters : [];
    const newSuppliers = recent.filter((s) => !older.includes(s));
    const droppedSuppliers = older.filter((s) => !recent.includes(s));

    return {
      importer: row.buyer_name_raw,
      country: row.dest_country,
      recent_supplier_count: parseInt(row.recent_count, 10),
      older_supplier_count: parseInt(row.older_count, 10),
      new_suppliers: newSuppliers,
      dropped_suppliers: droppedSuppliers,
      is_switching: droppedSuppliers.length > 0 && newSuppliers.length > 0,
      is_expanding: newSuppliers.length > 0 && droppedSuppliers.length === 0,
      is_consolidating: droppedSuppliers.length > 0 && newSuppliers.length === 0,
      opportunity_signal: droppedSuppliers.length > 0
        ? 'Buyer dropping suppliers — open to new sources'
        : newSuppliers.length > 0
          ? 'Buyer adding new suppliers — actively sourcing'
          : null,
    };
  }).filter((r) => r.opportunity_signal);
}

// ══════════════════════════════════════════════
// SUPPLIER CONCENTRATION RISK
// ══════════════════════════════════════════════

/**
 * Detect importers over-reliant on a single supplier (opportunity for India)
 */
async function analyzeSupplierConcentration() {
  const result = await query(`
    WITH supplier_shares AS (
      SELECT
        buyer_name_raw,
        dest_country,
        supplier_name_raw,
        origin_country,
        COUNT(*) AS shipments,
        SUM(COUNT(*)) OVER (PARTITION BY buyer_name_raw, dest_country) AS total_shipments
      FROM shipment_records
      WHERE buyer_name_raw IS NOT NULL AND supplier_name_raw IS NOT NULL
        AND ship_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY buyer_name_raw, dest_country, supplier_name_raw, origin_country
    )
    SELECT
      buyer_name_raw,
      dest_country,
      supplier_name_raw AS dominant_supplier,
      origin_country AS dominant_origin,
      shipments,
      total_shipments,
      ROUND(shipments::numeric / NULLIF(total_shipments, 0) * 100, 1) AS share_pct
    FROM supplier_shares
    WHERE total_shipments >= 3
    ORDER BY share_pct DESC
    LIMIT 100
  `);

  return result.rows
    .filter((row) => parseFloat(row.share_pct) >= 60) // 60%+ concentration
    .map((row) => ({
      importer: row.buyer_name_raw,
      country: row.dest_country,
      dominant_supplier: row.dominant_supplier,
      dominant_origin: row.dominant_origin,
      concentration_pct: parseFloat(row.share_pct),
      total_shipments: parseInt(row.total_shipments, 10),
      risk_level: parseFloat(row.share_pct) >= 90 ? 'critical'
        : parseFloat(row.share_pct) >= 75 ? 'high' : 'moderate',
      opportunity: row.dominant_origin !== 'India' && row.dominant_origin !== 'IND'
        ? `Buyer sourcing ${row.share_pct}% from ${row.dominant_origin} — India diversification opportunity`
        : null,
    }));
}

// ══════════════════════════════════════════════
// QUERY API
// ══════════════════════════════════════════════

export async function getShipmentTrends({ country, months = 12 } = {}) {
  let sql = `
    SELECT
      DATE_TRUNC('month', ship_date) AS month,
      COUNT(*) AS shipments,
      SUM(COALESCE(weight_kg, 0)) AS weight,
      SUM(COALESCE(estimated_value_usd, 0)) AS value,
      COUNT(DISTINCT buyer_name_raw) AS importers
    FROM shipment_records
    WHERE ship_date >= CURRENT_DATE - INTERVAL '${months} months'
  `;
  const params = [];
  if (country) { sql += ` AND dest_country = $1`; params.push(country); }
  sql += ` GROUP BY DATE_TRUNC('month', ship_date) ORDER BY month`;

  const result = await query(sql, params);
  return result.rows;
}

export default {
  runShipmentAnalysis, analyzeTradeRoutes, analyzeSeasonality,
  detectSupplierSwitching, analyzeSupplierConcentration, getShipmentTrends,
};
