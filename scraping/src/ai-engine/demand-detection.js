// ─────────────────────────────────────────────
// BuyerIQ — AI Demand Detection Engine
// ─────────────────────────────────────────────
// Cross-analyzes trade_statistics, shipment_records,
// and retail_product_data to identify high-demand
// products, growth trends, and emerging markets.
// ─────────────────────────────────────────────
import { query, transaction } from '../config/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ai:demand-detection');

/**
 * Run full demand detection analysis.
 * Persists results to demand_trends table.
 */
export async function runDemandDetection() {
  log.info('Running demand detection engine...');
  const startTime = Date.now();

  const [
    tradeGrowth,
    shipmentDemand,
    marketplaceDemand,
  ] = await Promise.all([
    analyzeTradeGrowth(),
    analyzeShipmentDemand(),
    analyzeMarketplaceDemand(),
  ]);

  // Merge signals across sources into unified demand scores
  const mergedDemand = mergeDemandSignals(tradeGrowth, shipmentDemand, marketplaceDemand);

  // Persist
  const persisted = await persistDemandTrends(mergedDemand);

  const duration = Date.now() - startTime;
  log.info(`Demand detection complete: ${mergedDemand.length} trends in ${duration}ms`);

  return {
    total_trends: mergedDemand.length,
    persisted,
    duration_ms: duration,
    sources: {
      trade_growth_signals: tradeGrowth.length,
      shipment_demand_signals: shipmentDemand.length,
      marketplace_demand_signals: marketplaceDemand.length,
    },
  };
}

// ══════════════════════════════════════════════
// TRADE GROWTH ANALYSIS
// ══════════════════════════════════════════════

async function analyzeTradeGrowth() {
  const result = await query(`
    WITH yearly_trade AS (
      SELECT
        partner_country AS market,
        hs_code,
        year,
        SUM(trade_value_usd) AS value,
        SUM(quantity_kg) AS weight
      FROM trade_statistics
      WHERE flow = 'import'
        AND (hs_code LIKE '4419%' OR hs_code LIKE '7323%' OR hs_code LIKE '7013%' OR hs_code LIKE '6911%' OR hs_code LIKE '6912%' OR hs_code LIKE '7615%' OR hs_code LIKE '3924%' OR hs_code LIKE '7013%' OR hs_code LIKE '4602%' OR hs_code LIKE '8215%' OR hs_code LIKE '7418%' OR hs_code LIKE '4205%' OR hs_code LIKE '3926%')
        AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - 5
      GROUP BY partner_country, hs_code, year
    ),
    growth AS (
      SELECT
        t2.market,
        t2.hs_code,
        t2.year AS latest_year,
        t2.value AS current_value,
        t1.value AS previous_value,
        t2.weight AS current_weight,
        CASE WHEN t1.value > 0
          THEN ROUND(((t2.value - t1.value) / t1.value * 100)::numeric, 1)
          ELSE NULL
        END AS yoy_growth_pct,
        CASE WHEN t1.value > 0
          THEN ROUND(((t2.value - t1.value))::numeric, 0)
          ELSE t2.value
        END AS absolute_change
      FROM yearly_trade t2
      LEFT JOIN yearly_trade t1
        ON t2.market = t1.market AND t2.hs_code = t1.hs_code AND t1.year = t2.year - 1
      WHERE t2.year = (SELECT MAX(year) FROM yearly_trade)
    )
    SELECT * FROM growth
    WHERE current_value > 100000
    ORDER BY yoy_growth_pct DESC NULLS LAST
    LIMIT 50
  `);

  return result.rows.map((row) => ({
    reporter_country: row.market,
    hs_code: row.hs_code,
    source: 'trade_statistics',
    trade_value_usd: parseFloat(row.current_value || 0),
    previous_estimated_value_usd: parseFloat(row.previous_value || 0),
    growth_rate_pct: row.yoy_growth_pct ? parseFloat(row.yoy_growth_pct) : null,
    import_volume_tons: parseFloat(row.current_weight || 0) / 1000,
    year: parseInt(row.latest_year, 10),
  }));
}

// ══════════════════════════════════════════════
// SHIPMENT-BASED DEMAND
// ══════════════════════════════════════════════

async function analyzeShipmentDemand() {
  const result = await query(`
    WITH monthly AS (
      SELECT
        dest_country,
        DATE_TRUNC('month', ship_date) AS month,
        COUNT(*) AS shipments,
        COUNT(DISTINCT buyer_name_raw) AS importers,
        SUM(COALESCE(weight_kg, 0)) AS weight
      FROM shipment_records
      WHERE ship_date >= CURRENT_DATE - INTERVAL '12 months'
        AND dest_country IS NOT NULL
      GROUP BY dest_country, DATE_TRUNC('month', ship_date)
    ),
    country_summary AS (
      SELECT
        dest_country,
        SUM(shipments) AS total_shipments,
        AVG(shipments) AS avg_monthly_shipments,
        MAX(importers) AS max_monthly_importers,
        SUM(weight) AS total_weight,
        -- Growth: compare last 3 months vs prior 3 months
        SUM(CASE WHEN month >= CURRENT_DATE - INTERVAL '3 months' THEN shipments ELSE 0 END) AS recent_3m,
        SUM(CASE WHEN month < CURRENT_DATE - INTERVAL '3 months'
              AND month >= CURRENT_DATE - INTERVAL '6 months' THEN shipments ELSE 0 END) AS prior_3m
      FROM monthly
      GROUP BY dest_country
      HAVING SUM(shipments) >= 3
    )
    SELECT *,
      CASE WHEN prior_3m > 0
        THEN ROUND(((recent_3m - prior_3m)::numeric / prior_3m * 100), 1)
        ELSE NULL
      END AS shipment_growth_pct
    FROM country_summary
    ORDER BY total_shipments DESC
    LIMIT 30
  `);

  return result.rows.map((row) => ({
    market_country: row.dest_country,
    source: 'shipment_records',
    shipment_count: parseInt(row.total_shipments, 10),
    unique_importers: parseInt(row.max_monthly_importers, 10),
    total_weight_kg: Math.round(parseFloat(row.total_weight || 0)),
    shipment_growth_pct: row.shipment_growth_pct ? parseFloat(row.shipment_growth_pct) : null,
    avg_monthly_shipments: Math.round(parseFloat(row.avg_monthly_shipments)),
  }));
}

// ══════════════════════════════════════════════
// MARKETPLACE DEMAND
// ══════════════════════════════════════════════

async function analyzeMarketplaceDemand() {
  const result = await query(`
    SELECT
      category,
      marketplace,
      COUNT(*) AS product_count,
      AVG(price) AS avg_price,
      AVG(rating) AS avg_rating,
      SUM(COALESCE(review_count, 0)) AS total_reviews,
      AVG(COALESCE(best_seller_rank, 0)) FILTER (WHERE best_seller_rank > 0) AS avg_bsr
    FROM retail_product_data
    WHERE marketplace IS NOT NULL
      AND scraped_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY category, marketplace
    HAVING COUNT(*) >= 3
    ORDER BY SUM(COALESCE(review_count, 0)) DESC
    LIMIT 30
  `);

  return result.rows.map((row) => ({
    product_category: row.category || 'wood_kitchenware',
    marketplace: row.marketplace,
    source: 'retail_product_data',
    retail_product_count: parseInt(row.product_count, 10),
    avg_retail_price: Math.round(parseFloat(row.avg_price || 0) * 100) / 100,
    avg_rating: Math.round(parseFloat(row.avg_rating || 0) * 100) / 100,
    total_reviews: parseInt(row.total_reviews || 0, 10),
    avg_bsr: row.avg_bsr ? Math.round(parseFloat(row.avg_bsr)) : null,
  }));
}

// ══════════════════════════════════════════════
// SIGNAL MERGING
// ══════════════════════════════════════════════

function mergeDemandSignals(tradeGrowth, shipmentDemand, marketplaceDemand) {
  const merged = new Map();

  // Index by market country
  for (const t of tradeGrowth) {
    const key = `${t.reporter_country}:${t.hs_code}`;
    merged.set(key, {
      product_category: 'wood_kitchenware',
      hs_code: t.hs_code,
      reporter_country: t.reporter_country,
      trade_value_usd: t.trade_value_usd,
      previous_estimated_value_usd: t.previous_estimated_value_usd,
      growth_rate_pct: t.growth_rate_pct,
      yoy_change_pct: t.growth_rate_pct,
      import_volume_tons: t.import_volume_tons,
      data_sources: ['trade_statistics'],
    });
  }

  // Enrich with shipment data
  for (const s of shipmentDemand) {
    const existingKey = [...merged.keys()].find((k) => k.includes(s.market_country));
    if (existingKey) {
      const existing = merged.get(existingKey);
      existing.shipment_count = s.shipment_count;
      existing.unique_importers = s.unique_importers;
      existing.shipment_growth_pct = s.shipment_growth_pct;
      existing.data_sources.push('shipment_records');
    } else {
      merged.set(`${s.market_country}:all`, {
        product_category: 'wood_kitchenware',
        hs_code: 'all',
        market_country: s.market_country,
        reporter_country: null,
        shipment_count: s.shipment_count,
        unique_importers: s.unique_importers,
        shipment_growth_pct: s.shipment_growth_pct,
        data_sources: ['shipment_records'],
      });
    }
  }

  // Enrich with marketplace data (spread across matching markets or create standalone)
  for (const m of marketplaceDemand) {
    // Try to match by marketplace's primary market (Amazon/Walmart → USA)
    const platformMarket = m.marketplace === 'amazon' || m.marketplace === 'walmart' ? 'USA' : null;
    const matchKey = platformMarket ? [...merged.keys()].find((k) => k.includes(platformMarket)) : null;

    if (matchKey) {
      const entry = merged.get(matchKey);
      entry.retail_product_count = (entry.retail_product_count || 0) + m.retail_product_count;
      entry.avg_retail_price = m.avg_retail_price;
      entry.avg_rating = m.avg_rating;
      entry.total_reviews = (entry.total_reviews || 0) + m.total_reviews;
      if (!entry.data_sources.includes('retail_product_data')) entry.data_sources.push('retail_product_data');
    } else {
      // Standalone marketplace demand signal
      merged.set(`marketplace:${m.marketplace}:${m.product_category}`, {
        product_category: m.product_category,
        hs_code: 'all',
        market_country: platformMarket,
        reporter_country: platformMarket,
        retail_product_count: m.retail_product_count,
        avg_retail_price: m.avg_retail_price,
        avg_rating: m.avg_rating,
        total_reviews: m.total_reviews,
        data_sources: ['retail_product_data'],
      });
    }
  }

  // Score each merged demand signal
  return [...merged.values()].map((d) => {
    d.demand_score = scoreDemand(d);

    // Classify trend with acceleration awareness
    const gr = d.growth_rate_pct;
    const sgr = d.shipment_growth_pct;
    const bestGrowth = gr !== null && gr !== undefined ? gr : sgr;

    if (bestGrowth !== null && bestGrowth !== undefined) {
      if (bestGrowth > 25) d.demand_trend = 'surging';
      else if (bestGrowth > 10) d.demand_trend = 'growing';
      else if (bestGrowth > -5) d.demand_trend = 'stable';
      else d.demand_trend = 'declining';
    } else {
      // Infer from marketplace only
      d.demand_trend = d.total_reviews > 5000 ? 'growing' : 'unknown';
    }

    d.confidence_score = Math.min(d.data_sources.length * 22 + 15, 90);
    d.analysis_period = 'last_12_months';
    d.peak_quarter = null;
    return d;
  }).sort((a, b) => b.demand_score - a.demand_score);
}

function scoreDemand(d) {
  let score = 0;

  // ── Trade value size (max 25) — continuous log scale ──
  const val = d.trade_value_usd || 0;
  if (val > 0) {
    // log10(100K)=5, log10(10M)=7, log10(100M)=8 → mapped to 0-25
    score += Math.min(Math.round(Math.log10(Math.max(val, 1)) * 3.5 - 10), 25);
    score = Math.max(score, 0);
  }

  // ── Growth rate (max 25) — continuous linear ──
  const gr = d.growth_rate_pct || d.shipment_growth_pct || 0;
  if (gr > 0) {
    score += Math.min(Math.round(gr * 0.8), 25);
  } else if (gr < -10) {
    score -= 5; // penalty for sharp decline
  }

  // ── Shipment activity (max 20) — log scale ──
  const ships = d.shipment_count || 0;
  if (ships > 0) {
    score += Math.min(Math.round(Math.log2(ships + 1) * 3.5), 20);
  }

  // ── Importer diversity (max 10) — more importers = stronger demand ──
  const importers = d.unique_importers || 0;
  score += Math.min(importers * 2, 10);

  // ── Marketplace demand (max 10) — review volume as sales proxy ──
  const reviews = d.total_reviews || 0;
  if (reviews > 0) {
    score += Math.min(Math.round(Math.log10(reviews + 1) * 3), 10);
  }

  // ── Multi-source confirmation (max 10) ──
  score += Math.min((d.data_sources?.length || 0) * 4, 10);

  return Math.min(Math.max(score, 0), 100);
}

// ══════════════════════════════════════════════
// PERSISTENCE
// ══════════════════════════════════════════════

async function persistDemandTrends(trends) {
  if (trends.length === 0) return 0;
  let count = 0;

  await transaction(async (client) => {
    for (const d of trends) {
      const res = await client.query(
        `INSERT INTO demand_trends
          (product_category, hs_code, market_country,
           demand_score, demand_trend, growth_rate_pct, yoy_change_pct,
           current_value_usd, previous_value_usd, import_volume_tons,
           retail_product_count, avg_retail_price, avg_rating, total_reviews,
           shipment_count, unique_importers, shipment_growth_pct,
           peak_quarter, data_sources, confidence_score, analysis_period)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (id)
         DO UPDATE SET
           demand_score = EXCLUDED.demand_score,
           demand_trend = EXCLUDED.demand_trend,
           growth_rate_pct = EXCLUDED.growth_rate_pct,
           current_value_usd = EXCLUDED.current_value_usd,
           shipment_count = EXCLUDED.shipment_count,
           data_sources = EXCLUDED.data_sources,
           confidence_score = EXCLUDED.confidence_score,
           detected_at = NOW(), updated_at = NOW()
         RETURNING id`,
        [
          d.product_category, d.hs_code, d.market_country,
          d.demand_score, d.demand_trend, d.growth_rate_pct || null, d.yoy_change_pct || null,
          d.current_value_usd || null, d.previous_value_usd || null, d.import_volume_tons || null,
          d.retail_product_count || 0, d.avg_retail_price || null, d.avg_rating || null, d.total_reviews || 0,
          d.shipment_count || 0, d.unique_importers || 0, d.shipment_growth_pct || null,
          d.peak_quarter || null, JSON.stringify(d.data_sources || []),
          d.confidence_score || 0, d.analysis_period || 'last_12_months',
        ]
      );
      count += res.rowCount;
    }
  });

  return count;
}

// ══════════════════════════════════════════════
// QUERY API
// ══════════════════════════════════════════════

export async function getDemandTrends({ limit = 30, minScore = 0, trend, country } = {}) {
  let sql = `SELECT * FROM demand_trends WHERE is_active = TRUE AND demand_score >= $1`;
  const params = [minScore];
  let idx = 2;

  if (trend) { sql += ` AND demand_trend = $${idx++}`; params.push(trend); }
  if (country) { sql += ` AND reporter_country = $${idx++}`; params.push(country); }

  sql += ` ORDER BY demand_score DESC LIMIT $${idx}`;
  params.push(limit);

  const result = await query(sql, params);
  return result.rows;
}

export default { runDemandDetection, getDemandTrends };
