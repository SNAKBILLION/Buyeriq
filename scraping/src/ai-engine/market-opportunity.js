// ─────────────────────────────────────────────
// BuyerIQ — AI Market Opportunity Engine
// ─────────────────────────────────────────────
// Cross-analyzes demand, competition, pricing,
// buyer availability, and supply gaps to generate
// scored export opportunities for Senses Lifestyle.
//
// opportunity_score = f(demand, competition,
//   price_advantage, growth, accessibility)
// ─────────────────────────────────────────────
import { query, transaction } from '../config/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ai:market-opportunity');

// India's known competitive advantages
const INDIA_STRENGTHS = {
  materials: ['mango', 'acacia', 'sheesham', 'rosewood', 'teak'],
  certifications: ['FSC', 'BSCI', 'SEDEX', 'ISO 9001'],
  avg_fob_per_ton: 3200, // competitive vs China's ~3800
  tariff_advantages: {
    GBR: { rate: 0, scheme: 'DCTS', note: '0% tariff under UK DCTS' },
    AUS: { rate: 0, scheme: 'AI-ECTA', note: '0% under India-Australia FTA' },
    ARE: { rate: 0, scheme: 'CEPA', note: '0% under India-UAE CEPA' },
    JPN: { rate: 0, scheme: 'India-Japan CEPA', note: 'Reduced tariff' },
  },
};

/**
 * Run full market opportunity detection.
 * Persists to market_opportunities table.
 */
export async function runOpportunityDetection() {
  log.info('Running market opportunity engine...');
  const startTime = Date.now();

  // Gather inputs from all data sources
  const [
    demandData,
    competitionData,
    pricingData,
    buyerAvailability,
    supplyGaps,
  ] = await Promise.all([
    gatherDemandSignals(),
    analyzeCompetition(),
    analyzePriceAdvantage(),
    countAvailableBuyers(),
    detectSupplyGaps(),
  ]);

  // Score each market opportunity
  const opportunities = scoreOpportunities(demandData, competitionData, pricingData, buyerAvailability, supplyGaps);

  // Persist
  const persisted = await persistOpportunities(opportunities);

  const duration = Date.now() - startTime;
  log.info(`Opportunity detection complete: ${opportunities.length} opportunities in ${duration}ms`);

  return {
    total_opportunities: opportunities.length,
    high_score: opportunities.filter((o) => o.opportunity_score >= 70).length,
    persisted,
    duration_ms: duration,
  };
}

// ══════════════════════════════════════════════
// DATA GATHERING
// ══════════════════════════════════════════════

async function gatherDemandSignals() {
  const result = await query(`
    SELECT
      market_country,
      hs_code,
      demand_score,
      growth_rate_pct,
      current_value_usd,
      shipment_count,
      unique_importers
    FROM demand_trends
    WHERE is_active = TRUE AND demand_score > 0
    ORDER BY demand_score DESC
  `);
  return result.rows;
}

async function analyzeCompetition() {
  // India's share vs top competitors in each market
  const result = await query(`
    SELECT
      ts1.partner_country AS market,
      ts1.trade_value_usd AS india_value,
      total.total_value,
      CASE WHEN total.total_value > 0
        THEN ROUND((ts1.trade_value_usd / total.total_value * 100)::numeric, 1)
        ELSE 0
      END AS india_share_pct,
      total.top_origin,
      total.top_origin_value
    FROM trade_statistics ts1
    JOIN (
      SELECT
        partner_country,
        SUM(trade_value_usd) AS total_value,
        (ARRAY_AGG(reporter_country ORDER BY trade_value_usd DESC))[1] AS top_origin,
        MAX(trade_value_usd) AS top_origin_value
      FROM trade_statistics
      WHERE flow = 'import' AND hs_code LIKE '4419%' OR hs_code LIKE '7323%' OR hs_code LIKE '7013%' OR hs_code LIKE '6911%' OR hs_code LIKE '6912%' OR hs_code LIKE '7615%' OR hs_code LIKE '3924%'
        AND year = (SELECT MAX(year) FROM trade_statistics)
      GROUP BY partner_country
    ) total ON ts1.partner_country = total.partner_country
    WHERE ts1.reporter_country = 'IND'
      AND ts1.flow = 'export'
      AND ts1.hs_code LIKE '4419%' OR ts1.hs_code LIKE '7323%' OR ts1.hs_code LIKE '7013%' OR ts1.hs_code LIKE '6911%' OR ts1.hs_code LIKE '6912%' OR ts1.hs_code LIKE '7615%' OR ts1.hs_code LIKE '3924%'
      AND ts1.year = (SELECT MAX(year) FROM trade_statistics)
    ORDER BY india_share_pct ASC
  `);

  return result.rows.map((r) => ({
    market: r.market,
    india_value: parseFloat(r.india_value || 0),
    total_market_value: parseFloat(r.total_value || 0),
    india_share_pct: parseFloat(r.india_share_pct || 0),
    top_competitor: r.top_origin,
    top_competitor_value: parseFloat(r.top_origin_value || 0),
    // Low India share = higher opportunity
    competition_score: Math.max(0, 100 - parseFloat(r.india_share_pct || 0) * 2),
  }));
}

async function analyzePriceAdvantage() {
  const result = await query(`
    SELECT
      dest_country,
      origin_country,
      AVG(CASE WHEN weight_kg > 0 THEN estimated_value_usd / weight_kg ELSE NULL END) AS avg_price_per_kg,
      COUNT(*) AS shipments
    FROM shipment_records
    WHERE weight_kg > 0 AND estimated_value_usd > 0
      AND ship_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY dest_country, origin_country
    HAVING COUNT(*) >= 2
    ORDER BY dest_country, avg_price_per_kg
  `);

  // Group by market, compare India vs competitors
  const markets = new Map();
  for (const row of result.rows) {
    const market = row.dest_country;
    if (!markets.has(market)) markets.set(market, []);
    markets.get(market).push({
      origin: row.origin_country,
      avg_price_per_kg: parseFloat(row.avg_price_per_kg),
      shipments: parseInt(row.shipments, 10),
    });
  }

  return [...markets.entries()].map(([market, origins]) => {
    const india = origins.find((o) => o.origin === 'India' || o.origin === 'IND');
    const cheapest = origins.sort((a, b) => a.avg_price_per_kg - b.avg_price_per_kg)[0];
    const avgPrice = origins.reduce((s, o) => s + o.avg_price_per_kg, 0) / origins.length;

    return {
      market,
      india_price_per_kg: india?.avg_price_per_kg || null,
      market_avg_price_per_kg: Math.round(avgPrice * 100) / 100,
      cheapest_origin: cheapest?.origin,
      cheapest_price: cheapest?.avg_price_per_kg,
      india_price_advantage: india && avgPrice > 0
        ? Math.round((1 - india.avg_price_per_kg / avgPrice) * 100)
        : null, // positive = India is cheaper
    };
  });
}

async function countAvailableBuyers() {
  const result = await query(`
    SELECT
      country,
      COUNT(*) AS buyer_count,
      AVG(buyer_score) AS avg_score,
      COUNT(*) FILTER (WHERE is_kitchenware_buyer) AS kitchenware_buyers,
      COUNT(*) FILTER (WHERE sources_from_india) AS india_sourcing
    FROM buyer_signals
    WHERE is_active = TRUE AND buyer_score >= 30
    GROUP BY country
  `);

  return result.rows.map((r) => ({
    country: r.country,
    buyer_count: parseInt(r.buyer_count, 10),
    avg_buyer_score: Math.round(parseFloat(r.avg_score || 0)),
    kitchenware_buyers: parseInt(r.kitchenware_buyers, 10),
    already_sourcing_india: parseInt(r.india_sourcing, 10),
  }));
}

async function detectSupplyGaps() {
  // Markets with growing demand but low supplier diversity
  const result = await query(`
    SELECT
      dest_country,
      COUNT(DISTINCT origin_country) AS supplier_countries,
      COUNT(DISTINCT supplier_name_raw) AS supplier_count,
      SUM(COALESCE(estimated_value_usd, 0)) AS total_value,
      BOOL_OR(origin_country IN ('India', 'IND')) AS india_present
    FROM shipment_records
    WHERE ship_date >= CURRENT_DATE - INTERVAL '12 months'
      AND dest_country IS NOT NULL
    GROUP BY dest_country
    HAVING COUNT(*) >= 3
    ORDER BY supplier_countries ASC
  `);

  return result.rows.map((r) => ({
    market: r.dest_country,
    supplier_country_count: parseInt(r.supplier_countries, 10),
    supplier_count: parseInt(r.supplier_count, 10),
    total_value: parseFloat(r.total_value || 0),
    india_present: r.india_present || false,
    supply_gap: parseInt(r.supplier_countries, 10) <= 3,
    gap_details: parseInt(r.supplier_countries, 10) <= 2
      ? `Only ${r.supplier_countries} source countries — high supply concentration risk for buyers`
      : parseInt(r.supplier_countries, 10) <= 3
        ? `Limited source diversity (${r.supplier_countries} countries) — opportunity for India`
        : null,
  }));
}

// ══════════════════════════════════════════════
// OPPORTUNITY SCORING
// ══════════════════════════════════════════════

function scoreOpportunities(demand, competition, pricing, buyers, gaps) {
  // Build a map of all markets
  const markets = new Map();

  const addMarket = (key) => {
    if (!markets.has(key)) {
      markets.set(key, {
        market_country: key,
        hs_code: 'all',
        product_category: 'wood_kitchenware',
        demand_score: 0, competition_score: 0, price_advantage_score: 0,
        growth_score: 0, accessibility_score: 0,
        import_value_usd: 0, import_growth_pct: 0, india_share_pct: 0,
        buyer_count: 0, top_competitors: [], supply_gap_detected: false,
        data_sources: [],
      });
    }
    return markets.get(key);
  };

  // Layer 1: Demand
  for (const d of demand) {
    const key = d.market_country || d.partner_country;
    if (!key) continue;
    const m = addMarket(key);
    m.partner_country = d.partner_country || key;
    m.demand_score = Math.min(d.demand_score || 0, 100);
    m.import_value_usd = d.trade_value_usd || 0;
    m.import_growth_pct = d.growth_rate_pct || 0;
    m.growth_score = d.growth_rate_pct > 20 ? 90 : d.growth_rate_pct > 10 ? 70 : d.growth_rate_pct > 0 ? 50 : 20;
    m.data_sources.push('demand_trends');
  }

  // Layer 2: Competition
  for (const c of competition) {
    const m = addMarket(c.market);
    m.competition_score = c.competition_score;
    m.india_share_pct = c.india_share_pct;
    m.india_growth_pct = null;
    m.top_competitors.push({ origin: c.top_competitor, value: c.top_competitor_value });
    if (!m.data_sources.includes('trade_statistics')) m.data_sources.push('trade_statistics');
  }

  // Layer 3: Price advantage
  for (const p of pricing) {
    const m = markets.get(p.market);
    if (!m) continue;
    m.price_advantage_score = p.india_price_advantage !== null
      ? Math.max(0, Math.min(50 + p.india_price_advantage, 100))
      : 50; // neutral if unknown
    m.avg_import_price_ton = p.market_avg_price_per_kg ? p.market_avg_price_per_kg * 1000 : null;
    m.india_fob_advantage = p.india_price_advantage;
  }

  // Layer 4: Buyer availability
  for (const b of buyers) {
    const m = markets.get(b.country);
    if (!m) continue;
    m.buyer_count = b.buyer_count;
    m.accessibility_score = Math.min(b.buyer_count * 5, 80) + (b.already_sourcing_india > 0 ? 20 : 0);
  }

  // Layer 5: Supply gaps
  for (const g of gaps) {
    const m = markets.get(g.market);
    if (!m) continue;
    m.supply_gap_detected = g.supply_gap;
    m.supply_gap_details = g.gap_details;
    // Supply gap boosts opportunity
    if (g.supply_gap && !g.india_present) {
      m.competition_score = Math.min(m.competition_score + 15, 100);
    }
  }

  // Layer 6: Tariff advantages
  for (const [code, tariff] of Object.entries(INDIA_STRENGTHS.tariff_advantages)) {
    const m = markets.get(code);
    if (!m) continue;
    m.accessibility_score = Math.min((m.accessibility_score || 0) + 20, 100);
    m.retail_price_range = { tariff_advantage: tariff.note };
  }

  // Calculate final opportunity_score
  // New formula: demand(30%) + growth(25%) + buyer_activity(20%) + price_advantage(15%) + supplier_gap(10%)
  return [...markets.values()].map((m) => {
    // Compute buyer_activity_score (0-100) from buyer count + wood buyer concentration
    const buyerActivity = Math.min(
      (m.buyer_count || 0) * 4 + (m.accessibility_score || 0) * 0.3,
      100
    );

    // Compute supplier_gap_score (0-100)
    const gapScore = m.supply_gap_detected
      ? (m.supply_gap_details?.includes('Only') ? 90 : 70)
      : 20;

    m.opportunity_score = Math.round(
      m.demand_score * 0.30 +
      m.growth_score * 0.25 +
      buyerActivity * 0.20 +
      m.price_advantage_score * 0.15 +
      gapScore * 0.10
    );

    // Also keep sub-scores for transparency
    m.buyer_activity_score = Math.round(buyerActivity);
    m.supplier_gap_score = gapScore;

    m.opportunity_type = m.opportunity_score >= 70 ? 'high_potential'
      : m.opportunity_score >= 50 ? 'moderate_potential'
      : m.opportunity_score >= 30 ? 'emerging'
      : 'monitor';

    m.confidence_score = Math.min(m.data_sources.length * 20, 80);
    m.analysis_period = 'last_12_months';

    // Generate recommended actions
    m.recommended_actions = generateActions(m);
    m.insight_text = generateInsightText(m);

    return m;
  }).sort((a, b) => b.opportunity_score - a.opportunity_score);
}

function generateActions(m) {
  const actions = [];
  if (m.supply_gap_detected) actions.push(`Supply gap detected — only ${m.supplier_gap_score >= 90 ? '1-2' : 'few'} source countries. First-mover advantage for India.`);
  if (m.india_share_pct < 5) actions.push(`India holds only ${m.india_share_pct || '<1'}% share — significant room for market entry.`);
  if (m.import_growth_pct > 15) actions.push(`Import growth ${m.import_growth_pct}% — high urgency, prioritize for immediate outreach.`);
  if (m.buyer_count > 5) actions.push(`${m.buyer_count} active buyers identified (buyer activity score: ${m.buyer_activity_score || 0}/100) — begin direct contact.`);
  if (m.buyer_count >= 1 && m.buyer_count <= 5) actions.push(`${m.buyer_count} buyer leads found — research and qualify before outreach.`);
  if (m.india_fob_advantage > 10) actions.push(`India has ${m.india_fob_advantage}% price advantage — lead with competitive FOB pricing.`);

  const tariff = INDIA_STRENGTHS.tariff_advantages[m.market_country];
  if (tariff) actions.push(`Tariff advantage: ${tariff.note}`);

  if (actions.length === 0) actions.push('Monitor market — collect more data before committing resources.');
  return actions;
}

function generateInsightText(m) {
  const parts = [];
  const country = m.partner_country || m.market_country;

  if (m.import_value_usd > 1000000) {
    parts.push(`${country} imports $${(m.import_value_usd / 1000000).toFixed(1)}M in kitchenware`);
  } else if (m.import_value_usd > 0) {
    parts.push(`${country} imports $${Math.round(m.import_value_usd / 1000)}K in wood kitchenware`);
  }

  if (m.import_growth_pct > 0) {
    parts.push(`demand ${m.import_growth_pct > 20 ? 'surging' : 'growing'} at ${m.import_growth_pct}% YoY`);
  }

  if (m.india_share_pct !== null && m.india_share_pct !== undefined && m.india_share_pct < 15) {
    parts.push(`India holds only ${m.india_share_pct}% market share — significant room for growth`);
  }

  if (m.supply_gap_detected) {
    parts.push('supplier concentration detected — buyers may welcome alternative sources');
  }

  if (m.buyer_count > 0) {
    parts.push(`${m.buyer_count} potential buyer${m.buyer_count > 1 ? 's' : ''} identified through shipment intelligence`);
  }

  if (m.india_fob_advantage > 10) {
    parts.push(`India has a ${m.india_fob_advantage}% price advantage vs market average`);
  }

  if (parts.length === 0) return `${country}: Market under observation — insufficient data for detailed insight.`;

  const conclusion = m.opportunity_score >= 70
    ? 'High-priority export opportunity — immediate action recommended.'
    : m.opportunity_score >= 50
      ? 'Moderate opportunity with strong fundamentals — further investigation recommended.'
      : m.opportunity_score >= 30
        ? 'Emerging opportunity — continue monitoring and build intelligence.'
        : 'Low priority — monitor for changes.';

  return parts.join('. ') + '. ' + conclusion;
}

// ══════════════════════════════════════════════
// PERSISTENCE
// ══════════════════════════════════════════════

async function persistOpportunities(opportunities) {
  if (opportunities.length === 0) return 0;
  let count = 0;

  await transaction(async (client) => {
    for (const o of opportunities) {
      const res = await client.query(
        `INSERT INTO market_opportunities
          (market_country, hs_code, product_category,
           opportunity_score, opportunity_type, demand_score, competition_score,
           price_advantage_score, growth_score, accessibility_score,
           import_value_usd, import_growth_pct, india_share_pct,
           top_competitors, buyer_count, avg_import_price_ton, india_fob_advantage,
           retail_price_range, supply_gap_detected, supply_gap_details,
           insight_text, recommended_actions,
           data_sources, confidence_score, analysis_period,
           detected_at, expires_at, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW(),NOW()+INTERVAL'30 days',TRUE)
         ON CONFLICT (market_country_code, hs_code, opportunity_type)
         DO UPDATE SET
           opportunity_score = EXCLUDED.opportunity_score,
           demand_score = EXCLUDED.demand_score,
           competition_score = EXCLUDED.competition_score,
           import_value_usd = EXCLUDED.import_value_usd,
           import_growth_pct = EXCLUDED.import_growth_pct,
           buyer_count = EXCLUDED.buyer_count,
           insight_text = EXCLUDED.insight_text,
           recommended_actions = EXCLUDED.recommended_actions,
           supply_gap_detected = EXCLUDED.supply_gap_detected,
           detected_at = NOW(), expires_at = NOW()+INTERVAL'30 days', updated_at = NOW()
         RETURNING id`,
        [
          o.market_country, o.hs_code, o.product_category,
          Math.round(o.opportunity_score), o.opportunity_type, Math.round(o.demand_score), Math.round(o.competition_score),
          Math.round(o.price_advantage_score), Math.round(o.growth_score), Math.round(o.accessibility_score),
          o.import_value_usd || null, o.import_growth_pct || null, o.india_share_pct || null,
          JSON.stringify(o.top_competitors || []), Math.round(o.buyer_count || 0),
          o.avg_import_price_ton || null, o.india_fob_advantage || null,
          JSON.stringify(o.retail_price_range || {}),
          o.supply_gap_detected || false, o.supply_gap_details || null,
          o.insight_text, JSON.stringify(o.recommended_actions || []),
          JSON.stringify(o.data_sources || []), Math.round(o.confidence_score), o.analysis_period,
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

export async function getOpportunities({ limit = 30, minScore = 0, type, country } = {}) {
  let sql = `SELECT * FROM market_opportunities WHERE is_active = TRUE AND opportunity_score >= $1`;
  const params = [minScore];
  let idx = 2;

  if (type) { sql += ` AND opportunity_type = $${idx++}`; params.push(type); }
  if (country) { sql += ` AND market_country = $${idx++}`; params.push(country); }

  sql += ` ORDER BY opportunity_score DESC LIMIT $${idx}`;
  params.push(limit);

  return (await query(sql, params)).rows;
}

export default { runOpportunityDetection, getOpportunities };
