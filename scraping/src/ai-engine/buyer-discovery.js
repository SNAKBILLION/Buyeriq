// ─────────────────────────────────────────────
// BuyerIQ — AI Buyer Discovery Engine
// ─────────────────────────────────────────────
// Queries accumulated shipment_records, companies,
// trade_statistics, and retail_product_data to
// detect and rank buyer opportunities.
//
// Signals:
//  - frequent_importer: regular shipment activity
//  - new_entrant: first appeared recently
//  - growth_trend: increasing import volume
//  - diversifying: expanding sourcing countries
//  - kitchenware_specialist: concentrated HS 4419+
// ─────────────────────────────────────────────
import { query, transaction } from '../config/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ai:buyer-discovery');

/**
 * Run full buyer discovery analysis across all accumulated data.
 * Returns scored buyer signals and persists to buyer_signals table.
 */
export async function runBuyerDiscovery() {
  log.info('Running buyer discovery engine...');
  const startTime = Date.now();
  const allSignals = [];

  // ── 1. Frequent importers (shipment pattern analysis) ──
  const frequentImporters = await detectFrequentImporters();
  allSignals.push(...frequentImporters);

  // ── 2. New market entrants ──
  const newEntrants = await detectNewEntrants();
  allSignals.push(...newEntrants);

  // ── 3. Growth trend importers ──
  const growthBuyers = await detectGrowthTrend();
  allSignals.push(...growthBuyers);

  // ── 4. Diversifying sourcing ──
  const diversifying = await detectSourcingDiversification();
  allSignals.push(...diversifying);

  // ── 5. Persist all signals ──
  const persisted = await persistBuyerSignals(allSignals);

  const duration = Date.now() - startTime;
  log.info(`Buyer discovery complete: ${allSignals.length} signals in ${duration}ms`, {
    frequent: frequentImporters.length,
    new_entrants: newEntrants.length,
    growth: growthBuyers.length,
    diversifying: diversifying.length,
    persisted,
  });

  return {
    total_signals: allSignals.length,
    persisted,
    duration_ms: duration,
    breakdown: {
      frequent_importers: frequentImporters.length,
      new_entrants: newEntrants.length,
      growth_trend: growthBuyers.length,
      diversifying: diversifying.length,
    },
  };
}

// ══════════════════════════════════════════════
// SIGNAL DETECTORS
// ══════════════════════════════════════════════

/**
 * Detect companies with frequent, regular shipments in HS 4419/4420
 */
async function detectFrequentImporters() {
  const result = await query(`
    SELECT
      buyer_name_raw AS company_name,
      dest_country AS country,
      COUNT(*) AS shipment_count,
      SUM(COALESCE(weight_kg, 0)) AS total_weight,
      SUM(COALESCE(estimated_value_usd, 0)) AS total_value,
      MIN(ship_date) AS first_shipment,
      MAX(ship_date) AS last_shipment,
      COUNT(DISTINCT supplier_name_raw) AS supplier_count,
      COUNT(DISTINCT origin_country) AS sourcing_country_count,
      ARRAY_AGG(DISTINCT origin_country) FILTER (WHERE origin_country IS NOT NULL) AS sourcing_countries,
      ARRAY_AGG(DISTINCT hs_code) FILTER (WHERE hs_code IS NOT NULL) AS hs_codes,
      ARRAY_AGG(DISTINCT supplier_name_raw) FILTER (WHERE supplier_name_raw IS NOT NULL) AS suppliers,
      BOOL_OR(origin_country IN ('India', 'IND', 'IN')) AS sources_from_india
    FROM shipment_records
    WHERE buyer_name_raw IS NOT NULL
      AND (hs_code LIKE '4419%' OR hs_code LIKE '4420%' OR hs_code LIKE '7323%' OR hs_code LIKE '7013%' OR hs_code LIKE '6911%' OR hs_code LIKE '6912%' OR hs_code LIKE '7615%' OR hs_code LIKE '3924%' OR hs_code IS NULL)
    GROUP BY buyer_name_raw, dest_country
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) DESC
    LIMIT 200
  `);

  return result.rows.map((row) => {
    const daySpan = row.first_shipment && row.last_shipment
      ? Math.max(1, (new Date(row.last_shipment) - new Date(row.first_shipment)) / 86400000)
      : 365;
    const avgDays = Math.round(daySpan / Math.max(row.shipment_count - 1, 1));

    return {
      company_name: row.company_name,
      country: row.country,
      signal_type: 'frequent_importer',
      buyer_type: classifyFromShipments(row),
      total_shipments: parseInt(row.shipment_count, 10),
      total_weight_kg: Math.round(parseFloat(row.total_weight || 0)),
      total_estimated_value_usd: Math.round(parseFloat(row.total_value || 0)),
      volume_tier: volumeTier(row.total_weight),
      frequency: frequencyLabel(avgDays),
      avg_days_between: avgDays,
      first_ship_date: row.first_shipment,
      last_ship_date: row.last_shipment,
      sourcing_countries: row.sourcing_countries || [],
      sourcing_country_count: parseInt(row.sourcing_country_count, 10),
      sources_from_india: row.sources_from_india || false,
      supplier_count: parseInt(row.supplier_count, 10),
      top_suppliers: (row.suppliers || []).slice(0, 5),
      hs_codes: row.hs_codes || [],
      is_kitchenware_buyer: (row.hs_codes || []).some((c) => c?.startsWith('4419') || c?.startsWith('4420') || c?.startsWith('7323') || c?.startsWith('7013') || c?.startsWith('6911') || c?.startsWith('6912') || c?.startsWith('7615') || c?.startsWith('3924') || c?.startsWith('4205')),
      buyer_score: scoreFrequentImporter(row, avgDays),
      confidence_score: 65,
      signal_source: 'shipment_analysis',
    };
  });
}

/**
 * Detect new importers appearing in the last 90 days
 */
async function detectNewEntrants() {
  const result = await query(`
    SELECT
      buyer_name_raw AS company_name,
      dest_country AS country,
      COUNT(*) AS shipment_count,
      SUM(COALESCE(estimated_value_usd, 0)) AS total_value,
      MIN(ship_date) AS first_shipment,
      MAX(ship_date) AS last_shipment,
      ARRAY_AGG(DISTINCT origin_country) FILTER (WHERE origin_country IS NOT NULL) AS sourcing_countries,
      ARRAY_AGG(DISTINCT hs_code) FILTER (WHERE hs_code IS NOT NULL) AS hs_codes
    FROM shipment_records
    WHERE buyer_name_raw IS NOT NULL
      AND ship_date >= CURRENT_DATE - INTERVAL '90 days'
      AND buyer_name_raw NOT IN (
        SELECT DISTINCT buyer_name_raw FROM shipment_records
        WHERE ship_date < CURRENT_DATE - INTERVAL '90 days'
          AND buyer_name_raw IS NOT NULL
      )
    GROUP BY buyer_name_raw, dest_country
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC
    LIMIT 100
  `);

  return result.rows.map((row) => ({
    company_name: row.company_name,
    country: row.country,
    signal_type: 'new_entrant',
    buyer_type: 'unknown',
    total_shipments: parseInt(row.shipment_count, 10),
    total_estimated_value_usd: Math.round(parseFloat(row.total_value || 0)),
    first_ship_date: row.first_shipment,
    last_ship_date: row.last_shipment,
    sourcing_countries: row.sourcing_countries || [],
    sourcing_country_count: (row.sourcing_countries || []).length,
    hs_codes: row.hs_codes || [],
    is_kitchenware_buyer: (row.hs_codes || []).some((c) => c?.startsWith('4419') || c?.startsWith('4420') || c?.startsWith('7323') || c?.startsWith('7013') || c?.startsWith('6911') || c?.startsWith('6912') || c?.startsWith('7615') || c?.startsWith('3924') || c?.startsWith('4205')),
    buyer_score: scoreNewEntrant(row),
    confidence_score: 50,
    signal_source: 'new_entrant_detection',
  }));
}

/**
 * Detect importers whose volume is growing YoY
 */
async function detectGrowthTrend() {
  const result = await query(`
    WITH yearly AS (
      SELECT
        buyer_name_raw,
        dest_country,
        EXTRACT(YEAR FROM ship_date) AS yr,
        COUNT(*) AS shipments,
        SUM(COALESCE(estimated_value_usd, 0)) AS value
      FROM shipment_records
      WHERE buyer_name_raw IS NOT NULL
        AND ship_date IS NOT NULL
        AND ship_date >= CURRENT_DATE - INTERVAL '2 years'
      GROUP BY buyer_name_raw, dest_country, EXTRACT(YEAR FROM ship_date)
    ),
    growth AS (
      SELECT
        y2.buyer_name_raw AS company_name,
        y2.dest_country AS country,
        y1.shipments AS prev_shipments,
        y2.shipments AS curr_shipments,
        y1.value AS prev_value,
        y2.value AS curr_value,
        CASE WHEN y1.shipments > 0
          THEN ROUND(((y2.shipments::numeric - y1.shipments) / y1.shipments * 100), 1)
          ELSE 100
        END AS growth_pct
      FROM yearly y2
      JOIN yearly y1 ON y1.buyer_name_raw = y2.buyer_name_raw
        AND y1.dest_country = y2.dest_country
        AND y1.yr = y2.yr - 1
      WHERE y2.yr = EXTRACT(YEAR FROM CURRENT_DATE)
        OR y2.yr = EXTRACT(YEAR FROM CURRENT_DATE) - 1
    )
    SELECT * FROM growth
    WHERE growth_pct > 20
    ORDER BY growth_pct DESC
    LIMIT 100
  `);

  return result.rows.map((row) => ({
    company_name: row.company_name,
    country: row.country,
    signal_type: 'growth_trend',
    buyer_type: 'unknown',
    total_shipments: parseInt(row.curr_shipments, 10),
    total_estimated_value_usd: Math.round(parseFloat(row.curr_value || 0)),
    buyer_score: scoreGrowthBuyer(row.growth_pct),
    confidence_score: 60,
    signal_source: 'yoy_growth_analysis',
    raw_data: {
      prev_shipments: parseInt(row.prev_shipments, 10),
      curr_shipments: parseInt(row.curr_shipments, 10),
      growth_pct: parseFloat(row.growth_pct),
    },
  }));
}

/**
 * Detect importers actively diversifying sourcing countries
 */
async function detectSourcingDiversification() {
  const result = await query(`
    WITH recent AS (
      SELECT buyer_name_raw, dest_country,
             COUNT(DISTINCT origin_country) AS recent_origins
      FROM shipment_records
      WHERE ship_date >= CURRENT_DATE - INTERVAL '6 months'
        AND buyer_name_raw IS NOT NULL
      GROUP BY buyer_name_raw, dest_country
    ),
    older AS (
      SELECT buyer_name_raw, dest_country,
             COUNT(DISTINCT origin_country) AS older_origins
      FROM shipment_records
      WHERE ship_date < CURRENT_DATE - INTERVAL '6 months'
        AND ship_date >= CURRENT_DATE - INTERVAL '18 months'
        AND buyer_name_raw IS NOT NULL
      GROUP BY buyer_name_raw, dest_country
    )
    SELECT
      r.buyer_name_raw AS company_name,
      r.dest_country AS country,
      r.recent_origins,
      COALESCE(o.older_origins, 0) AS older_origins,
      r.recent_origins - COALESCE(o.older_origins, 0) AS new_origins
    FROM recent r
    LEFT JOIN older o ON r.buyer_name_raw = o.buyer_name_raw
      AND r.dest_country = o.dest_country
    WHERE r.recent_origins > COALESCE(o.older_origins, 0)
      AND r.recent_origins >= 2
    ORDER BY (r.recent_origins - COALESCE(o.older_origins, 0)) DESC
    LIMIT 50
  `);

  return result.rows.map((row) => ({
    company_name: row.company_name,
    country: row.country,
    signal_type: 'diversifying',
    buyer_type: 'unknown',
    sourcing_country_count: parseInt(row.recent_origins, 10),
    buyer_score: Math.min(30 + parseInt(row.new_origins, 10) * 12 + parseInt(row.recent_origins, 10) * 5, 85),
    confidence_score: 55,
    signal_source: 'diversification_detection',
    raw_data: {
      recent_origins: parseInt(row.recent_origins, 10),
      older_origins: parseInt(row.older_origins, 10),
      new_origins: parseInt(row.new_origins, 10),
    },
  }));
}

// ══════════════════════════════════════════════
// PERSISTENCE
// ══════════════════════════════════════════════

async function persistBuyerSignals(signals) {
  if (signals.length === 0) return 0;
  let count = 0;

  await transaction(async (client) => {
    for (const s of signals) {
      const res = await client.query(
        `INSERT INTO buyer_signals
          (company_name, country, buyer_type, signal_type,
           total_shipments, total_weight_kg, total_value_usd, volume_tier,
           frequency, avg_days_between, first_shipment_date, last_shipment_date,
           sourcing_countries, sourcing_country_count, sources_from_india,
           supplier_count, top_suppliers, hs_codes, relevant_hs_codes,
           is_kitchenware_buyer, buyer_score, confidence_score, signal_source, raw_data,
           detected_at, expires_at, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW(),NOW()+INTERVAL'30 days',TRUE)
         ON CONFLICT (company_name, country, signal_type)
         DO UPDATE SET
           buyer_score = GREATEST(buyer_signals.buyer_score, EXCLUDED.buyer_score),
           total_shipments = EXCLUDED.total_shipments,
           total_value_usd = EXCLUDED.total_value_usd,
           sources_from_india = EXCLUDED.sources_from_india,
           is_kitchenware_buyer = EXCLUDED.is_kitchenware_buyer,
           raw_data = EXCLUDED.raw_data,
           detected_at = NOW(),
           expires_at = NOW() + INTERVAL '30 days',
           updated_at = NOW()
         RETURNING id`,
        [
          s.company_name, s.country, s.buyer_type, s.signal_type,
          s.total_shipments || 0, s.total_weight_kg || 0, s.total_estimated_value_usd || s.total_value_usd || 0, s.volume_tier || null,
          s.frequency || null, s.avg_days_between || null, s.first_ship_date || s.first_shipment_date || null, s.last_ship_date || s.last_shipment_date || null,
          JSON.stringify(s.sourcing_countries || []), s.sourcing_country_count || 0, s.sources_from_india || false,
          s.supplier_count || 0, JSON.stringify(s.top_suppliers || []),
          JSON.stringify(s.hs_codes || []), JSON.stringify(s.relevant_hs_codes || []),
          s.is_kitchenware_buyer || false, s.buyer_score || 0, s.confidence_score || 0,
          s.signal_source || 'unknown', JSON.stringify(s.raw_data || {}),
        ]
      );
      count += res.rowCount;
    }
  });

  return count;
}

// ══════════════════════════════════════════════
// QUERY API (for /api/intelligence/buyers)
// ══════════════════════════════════════════════

export async function getBuyerSignals({ limit = 50, minScore = 0, country, kitchenwareOnly, signalType } = {}) {
  let sql = `SELECT * FROM buyer_signals WHERE is_active = TRUE AND buyer_score >= $1`;
  const params = [minScore];
  let idx = 2;

  if (country) { sql += ` AND country_code = $${idx++}`; params.push(country); }
  if (kitchenwareOnly) { sql += ` AND is_kitchenware_buyer = TRUE`; }
  if (signalType) { sql += ` AND signal_type = $${idx++}`; params.push(signalType); }

  sql += ` ORDER BY buyer_score DESC LIMIT $${idx}`;
  params.push(limit);

  const result = await query(sql, params);
  return result.rows;
}

export async function getBuyerSignalStats() {
  const result = await query(`
    SELECT
      signal_type,
      COUNT(*) AS count,
      AVG(buyer_score)::int AS avg_score,
      COUNT(*) FILTER (WHERE is_kitchenware_buyer) AS kitchenware_buyers,
      COUNT(*) FILTER (WHERE sources_from_india) AS india_sourcing
    FROM buyer_signals WHERE is_active = TRUE
    GROUP BY signal_type ORDER BY count DESC
  `);
  return result.rows;
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function volumeTier(weight) {
  const w = parseFloat(weight || 0);
  if (w > 50000) return 'HIGH';
  if (w > 10000) return 'MEDIUM';
  if (w > 1000) return 'LOW';
  return 'MICRO';
}

function frequencyLabel(avgDays) {
  if (avgDays <= 10) return 'weekly';
  if (avgDays <= 20) return 'biweekly';
  if (avgDays <= 45) return 'monthly';
  if (avgDays <= 120) return 'quarterly';
  return 'irregular';
}

function classifyFromShipments(row) {
  const name = (row.company_name || '').toLowerCase();
  if (/retail|store|mart|shop|boutique/.test(name)) return 'retailer';
  if (/wholesale|distribut|supply/.test(name)) return 'distributor';
  if (/hotel|resort|restaurant|hospitality/.test(name)) return 'hospitality';
  return 'unknown';
}

function scoreNewEntrant(row) {
  let score = 30; // base: new entrants start at 30
  const shipments = parseInt(row.shipment_count || 0, 10);
  score += Math.min(shipments * 8, 30);  // rapid ramp = stronger signal
  const val = parseFloat(row.total_value || 0);
  if (val > 100000) score += 15; else if (val > 10000) score += 10; else score += 5;
  const hasKitchenware = (row.hs_codes || []).some((c) => c?.startsWith('4419') || c?.startsWith('4420') || c?.startsWith('7323') || c?.startsWith('7013') || c?.startsWith('6911') || c?.startsWith('6912') || c?.startsWith('7615') || c?.startsWith('3924') || c?.startsWith('4205'));
  if (hasKitchenware) score += 10;
  return Math.min(score, 85); // cap: new entrants lack track record
}

function scoreGrowthBuyer(growthPct) {
  let score = 30;
  const g = parseFloat(growthPct || 0);
  // Continuous scoring: growth rate maps to 0-50 range
  score += Math.min(Math.round(g * 0.8), 50);
  return Math.min(score, 95);
}

/**
 * Enhanced buyer scoring: weighted 4-factor model
 *
 * buyer_score =
 *   shipment_frequency  × 0.35
 * + import_growth_rate  × 0.25
 * + sourcing_diversification × 0.20
 * + supplier_switching   × 0.20
 *
 * Each sub-score is 0-100 before weighting.
 * Bonuses for HS relevance and India sourcing are applied after.
 */
function scoreFrequentImporter(row, avgDays) {
  // ── Factor 1: Shipment Frequency (0-100, weight 0.35) ──
  let freqScore = 0;
  const shipments = parseInt(row.shipment_count || 0, 10);
  // Volume contribution (40% of factor)
  if (shipments >= 20) freqScore += 40;
  else if (shipments >= 10) freqScore += 30;
  else if (shipments >= 5) freqScore += 20;
  else freqScore += Math.min(shipments * 4, 15);
  // Regularity contribution (40% of factor)
  if (avgDays <= 14) freqScore += 40;
  else if (avgDays <= 30) freqScore += 35;
  else if (avgDays <= 60) freqScore += 25;
  else if (avgDays <= 120) freqScore += 15;
  else freqScore += 5;
  // Weight contribution (20% of factor)
  const wt = parseFloat(row.total_weight || 0);
  if (wt > 50000) freqScore += 20;
  else if (wt > 10000) freqScore += 15;
  else if (wt > 1000) freqScore += 10;
  else freqScore += 5;

  // ── Factor 2: Import Growth Rate (0-100, weight 0.25) ──
  // Estimated from shipment distribution over time
  let growthScore = 50; // default neutral
  if (row.first_shipment && row.last_shipment) {
    const firstDate = new Date(row.first_shipment);
    const lastDate = new Date(row.last_shipment);
    const totalDays = Math.max(1, (lastDate - firstDate) / 86400000);
    const midpoint = new Date(firstDate.getTime() + totalDays / 2 * 86400000);
    // Proxy: if last shipment is recent, buyer is active/growing
    const daysSinceLast = (Date.now() - lastDate.getTime()) / 86400000;
    if (daysSinceLast <= 30) growthScore = 90;
    else if (daysSinceLast <= 90) growthScore = 70;
    else if (daysSinceLast <= 180) growthScore = 50;
    else growthScore = 20;
  }

  // ── Factor 3: Sourcing Diversification (0-100, weight 0.20) ──
  const originCount = parseInt(row.sourcing_country_count || 0, 10);
  let diverseScore = 0;
  if (originCount >= 5) diverseScore = 100;
  else if (originCount >= 3) diverseScore = 75;
  else if (originCount >= 2) diverseScore = 50;
  else diverseScore = 20;

  // ── Factor 4: Supplier Switching (0-100, weight 0.20) ──
  // Multiple suppliers = higher switching activity = more opportunity
  const supplierCount = parseInt(row.supplier_count || 0, 10);
  let switchScore = 0;
  if (supplierCount >= 5) switchScore = 100;
  else if (supplierCount >= 3) switchScore = 70;
  else if (supplierCount >= 2) switchScore = 45;
  else switchScore = 15;

  // ── Weighted composite ──
  let score = Math.round(
    freqScore * 0.35 +
    growthScore * 0.25 +
    diverseScore * 0.20 +
    switchScore * 0.20
  );

  // ── Bonuses (additive, capped at 100) ──
  const hasKitchenware = (row.hs_codes || []).some((c) => c?.startsWith('4419') || c?.startsWith('4420') || c?.startsWith('7323') || c?.startsWith('7013') || c?.startsWith('6911') || c?.startsWith('6912') || c?.startsWith('7615') || c?.startsWith('3924') || c?.startsWith('4205'));
  if (hasKitchenware) score += 8; // HS relevance bonus
  if (row.sources_from_india) score += 5; // already sourcing India = warm lead

  return Math.min(score, 100);
}

export default { runBuyerDiscovery, getBuyerSignals, getBuyerSignalStats };
