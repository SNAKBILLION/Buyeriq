// ─────────────────────────────────────────────
// BuyerIQ — AI Export Insight Generator
// ─────────────────────────────────────────────
// Synthesizes outputs from buyer discovery,
// shipment analysis, demand detection, and
// opportunity detection into human-readable
// intelligence reports stored in the
// intelligence_reports table.
// ─────────────────────────────────────────────
import { query, transaction } from '../config/database.js';
import { calculateMarginPotential } from '../intelligence/price-intelligence.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ai:insight-generator');

/**
 * Run full insight generation from all AI engine results.
 */
export async function generateInsights() {
  log.info('Generating intelligence insights...');
  const startTime = Date.now();
  const reports = [];

  // ── 1. Opportunity alerts (from market_opportunities) ──
  const oppInsights = await generateOpportunityInsights();
  reports.push(...oppInsights);

  // ── 2. Buyer alerts (from buyer_signals) ──
  const buyerInsights = await generateBuyerInsights();
  reports.push(...buyerInsights);

  // ── 3. Demand trend alerts ──
  const demandInsights = await generateDemandInsights();
  reports.push(...demandInsights);

  // ── 4. Supply gap alerts (from shipment analysis) ──
  const gapInsights = await generateSupplyGapInsights();
  reports.push(...gapInsights);

  // ── 5. Price intelligence alerts ──
  const priceInsights = await generatePriceInsights();
  reports.push(...priceInsights);

  // Persist intelligence reports
  const persisted = await persistReports(reports);

  // Generate alerts from high-severity reports
  const alertsGenerated = await generateAlertsFromReports(reports);

  const duration = Date.now() - startTime;
  log.info(`Insight generation complete: ${reports.length} reports, ${alertsGenerated} alerts in ${duration}ms`);

  return { total_reports: reports.length, persisted, alerts_generated: alertsGenerated, duration_ms: duration };
}

// ══════════════════════════════════════════════
// INSIGHT GENERATORS
// ══════════════════════════════════════════════

async function generateOpportunityInsights() {
  const result = await query(`
    SELECT * FROM market_opportunities
    WHERE is_active = TRUE AND opportunity_score >= 1
    ORDER BY opportunity_score DESC LIMIT 10
  `);

  return result.rows.map((opp) => ({
    report_type: 'opportunity_alert',
    title: `Export Opportunity: ${opp.partner_country || opp.market_country} (Score: ${opp.opportunity_score}/100)`,
    insight_text: opp.insight_text || `High-potential export opportunity detected in ${opp.partner_country || opp.market_country} for HS ${opp.hs_code} products.`,
    severity: opp.opportunity_score >= 80 ? 'critical' : opp.opportunity_score >= 70 ? 'high' : 'medium',
    category: 'market_opportunity',
    related_country: opp.partner_country,
    related_hs_code: opp.hs_code,
    relevance_score: opp.opportunity_score,
    confidence_score: opp.confidence_score || 50,
    impact_score: estimateImpact(opp.import_estimated_value_usd, opp.india_share_pct),
    recommended_actions: opp.recommended_actions || [],
    target_audience: 'export_manager',
    data_sources: opp.data_sources || [],
    supporting_data: {
      opportunity_score: opp.opportunity_score,
      demand_score: opp.demand_score,
      competition_score: opp.competition_score,
      import_value: opp.import_estimated_value_usd,
      india_share: opp.india_share_pct,
      buyer_count: opp.buyer_count,
    },
  }));
}

async function generateBuyerInsights() {
  const reports = [];

  // High-score new buyers
  const newBuyers = await query(`
    SELECT * FROM buyer_signals
    WHERE is_active = TRUE AND signal_type = 'new_entrant' AND buyer_score >= 50
    ORDER BY buyer_score DESC LIMIT 5
  `);

  for (const b of newBuyers.rows) {
    reports.push({
      report_type: 'buyer_alert',
      title: `New Buyer Detected: ${b.company_name} (${b.country || 'Unknown'})`,
      insight_text: `${b.company_name} has entered the market with ${b.total_shipments} shipments. ${b.is_kitchenware_buyer ? 'Confirmed kitchenware importer.' : 'Product category to be verified.'} Buyer score: ${b.buyer_score}/100.`,
      severity: b.buyer_score >= 70 ? 'high' : 'medium',
      category: 'buyer_discovery',
      related_country: b.country,
      related_company: b.company_name,
      relevance_score: b.buyer_score,
      confidence_score: b.confidence_score || 50,
      impact_score: b.is_kitchenware_buyer ? 70 : 40,
      recommended_actions: [
        'Research company website and product range',
        'Check ImportYeti for detailed shipment history',
        b.sources_from_india ? 'Already sources from India — warm lead' : 'Not yet sourcing from India — cold outreach needed',
      ],
      target_audience: 'sales_team',
      data_sources: [b.signal_source],
      supporting_data: {
        buyer_score: b.buyer_score,
        total_shipments: b.total_shipments,
        sourcing_countries: b.sourcing_countries,
        is_kitchenware_buyer: b.is_kitchenware_buyer,
      },
    });
  }

  // Diversifying buyers (actively looking for new suppliers)
  const diversifying = await query(`
    SELECT * FROM buyer_signals
    WHERE is_active = TRUE AND signal_type = 'diversifying' AND buyer_score >= 40
    ORDER BY buyer_score DESC LIMIT 5
  `);

  for (const b of diversifying.rows) {
    reports.push({
      report_type: 'buyer_alert',
      title: `Sourcing Diversification: ${b.company_name}`,
      insight_text: `${b.company_name} is expanding its supplier base (now sourcing from ${b.sourcing_country_count} countries). This signals openness to new suppliers — potential outreach opportunity.`,
      severity: 'medium',
      category: 'buyer_discovery',
      related_company: b.company_name,
      related_country: b.country,
      relevance_score: b.buyer_score,
      confidence_score: 55,
      impact_score: 50,
      recommended_actions: [
        'Prepare competitive offer highlighting India quality + pricing',
        'Emphasize certifications: FSC, BSCI, SEDEX compliance',
      ],
      target_audience: 'sales_team',
      data_sources: [b.signal_source],
    });
  }

  return reports;
}

async function generateDemandInsights() {
  const result = await query(`
    SELECT * FROM demand_trends
    WHERE is_active = TRUE AND demand_score >= 1
    ORDER BY demand_score DESC LIMIT 5
  `);

  return result.rows.map((d) => ({
    report_type: 'demand_alert',
    title: `${d.demand_trend === 'surging' ? '📈 Surging' : '↗️ Growing'} Demand: ${d.partner_country || d.market_country}`,
    insight_text: `Demand for ${d.product_category || 'wood kitchenware'} in ${d.partner_country || d.market_country} is ${d.demand_trend}${d.growth_rate_pct ? ` at ${d.growth_rate_pct}% YoY` : ''}. ${d.shipment_count ? `${d.shipment_count} shipments tracked.` : ''} ${d.unique_importers ? `${d.unique_importers} active importers.` : ''} Demand score: ${d.demand_score}/100.`,
    severity: d.demand_score >= 70 ? 'high' : 'medium',
    category: 'demand_trend',
    related_country: d.partner_country,
    related_hs_code: d.hs_code,
    relevance_score: d.demand_score,
    confidence_score: d.confidence_score || 50,
    impact_score: d.trade_value_usd > 5000000 ? 80 : d.trade_value_usd > 1000000 ? 60 : 40,
    recommended_actions: [
      `Focus product development on ${d.product_category || 'wood kitchenware'} for ${d.partner_country || d.market_country}`,
      d.growth_rate_pct > 20 ? 'Rapidly growing market — prioritize for Q2 strategy' : 'Steady growth — build long-term presence',
    ],
    target_audience: 'export_manager',
    data_sources: d.data_sources || [],
  }));
}

async function generateSupplyGapInsights() {
  const result = await query(`
    SELECT * FROM market_opportunities
    WHERE is_active = TRUE AND opportunity_score >= 1
    ORDER BY opportunity_score DESC LIMIT 5
  `);

  return result.rows.map((o) => ({
    report_type: 'supply_gap_alert',
    title: `Supply Gap: ${o.partner_country || o.market_country}`,
    insight_text: o.supply_gap_details || `Supply concentration detected in ${o.partner_country || o.market_country}. Buyers may be seeking alternative sources. India can fill this gap.`,
    severity: 'high',
    category: 'supply_gap',
    related_country: o.partner_country,
    related_hs_code: o.hs_code,
    relevance_score: o.opportunity_score,
    confidence_score: o.confidence_score || 50,
    impact_score: 75,
    recommended_actions: [
      'India not yet present — first-mover advantage available',
      'Prepare samples and compliance documentation for market entry',
      'Research local import regulations and labeling requirements',
    ],
    target_audience: 'export_manager',
    data_sources: o.data_sources || [],
  }));
}

async function generatePriceInsights() {
  // Use the upgraded margin potential calculator
  let margins = [];
  try {
    margins = await calculateMarginPotential();
  } catch (err) {
    log.warn('Margin calculator unavailable, falling back to price_data', { error: err.message });
  }

  // Generate insights from margin analysis
  if (margins.length > 0) {
    return margins.slice(0, 8).map((m) => {
      const fobStr = m.estimated_fob ? `$${m.estimated_fob.toFixed(2)}` : 'N/A';
      const marginStr = m.gross_margin_pct !== null ? `${m.gross_margin_pct}%` : 'N/A';
      const landedStr = m.landed_cost_estimate ? `$${m.landed_cost_estimate.toFixed(2)}` : 'N/A';

      return {
        report_type: 'price_intelligence',
        title: `Margin Analysis: ${m.category} on ${m.marketplace || 'marketplace'} (${m.margin_tier})`,
        insight_text: `${m.category} on ${m.marketplace || 'marketplace'}: retail median $${m.retail_median.toFixed(2)} (range $${m.retail_p25.toFixed(2)}-$${m.retail_p75.toFixed(2)}, ${m.product_count} products). Estimated FOB: ${fobStr} (source: ${m.fob_source.replace(/_/g, ' ')}). Landed cost: ${landedStr}. Gross margin potential: ${marginStr}.`,
        severity: m.margin_tier === 'excellent' ? 'high'
          : m.margin_tier === 'good' ? 'medium' : 'info',
        category: 'price_intelligence',
        related_product: m.category,
        relevance_score: m.gross_margin_pct >= 50 ? 80 : m.gross_margin_pct >= 35 ? 60 : 40,
        confidence_score: m.fob_source === 'india_shipment_data' ? 75 : 55,
        impact_score: m.gross_margin_pct >= 50 ? 70 : m.gross_margin_pct >= 35 ? 50 : 30,
        recommended_actions: [
          `Target FOB at or below ${fobStr} for ${m.category}`,
          m.margin_tier === 'excellent'
            ? 'High-margin category — consider premium positioning'
            : m.margin_tier === 'thin'
              ? 'Thin margin — compete on volume or differentiate on quality'
              : 'Healthy margin — standard competitive pricing works',
          m.india_shipment_count > 0
            ? `Based on ${m.india_shipment_count} actual India shipment records`
            : 'FOB based on retail multiplier — validate with actual quotes',
        ],
        target_audience: 'pricing_team',
        data_sources: [m.marketplace, m.fob_source],
        supporting_data: {
          retail_median: m.retail_median,
          retail_range: [m.retail_p25, m.retail_p75],
          estimated_fob: m.estimated_fob,
          landed_cost: m.landed_cost_estimate,
          gross_margin_pct: m.gross_margin_pct,
          margin_tier: m.margin_tier,
          fob_source: m.fob_source,
          product_count: m.product_count,
        },
      };
    });
  }

  // Fallback: basic price_data query (original logic, simplified)
  const result = await query(`
    SELECT marketplace, product_title AS category,
           AVG(price) AS avg_price, MIN(price) AS min_price,
           MAX(price) AS max_price, COUNT(*) AS data_points
    FROM price_data
    WHERE scraped_at >= CURRENT_DATE - INTERVAL '30 days' AND price > 0
    GROUP BY marketplace, product_title
    HAVING COUNT(*) >= 5 ORDER BY COUNT(*) DESC LIMIT 5
  `);

  return result.rows.map((p) => {
    const avg = parseFloat(p.avg_price);
    const fob = avg / 5;
    const landed = fob * 1.35;
    const margin = Math.round((1 - landed / avg) * 100);
    return {
      report_type: 'price_intelligence',
      title: `Price Benchmark: ${p.category || 'Wood Kitchenware'} on ${p.marketplace || 'marketplace'}`,
      insight_text: `Retail avg $${avg.toFixed(2)}, est. FOB $${fob.toFixed(2)}, landed $${landed.toFixed(2)}, margin ~${margin}%.`,
      severity: 'info',
      category: 'price_intelligence',
      related_product: p.category,
      relevance_score: 50,
      confidence_score: 55,
      impact_score: 35,
      recommended_actions: [`Target FOB below $${fob.toFixed(2)}`],
      target_audience: 'pricing_team',
      data_sources: [p.marketplace],
      supporting_data: { avg_retail: avg, estimated_fob: fob, gross_margin_pct: margin },
    };
  });
}

// ══════════════════════════════════════════════
// PERSISTENCE
// ══════════════════════════════════════════════

async function persistReports(reports) {
  if (reports.length === 0) return 0;
  let count = 0;

  await transaction(async (client) => {
    for (const r of reports) {
      const res = await client.query(
        `INSERT INTO intelligence_reports
          (report_type, title, insight_text, severity, category,
           related_country, related_company, related_hs_code, related_product,
           relevance_score, confidence_score, impact_score,
           recommended_actions, target_audience,
           data_sources, supporting_data,
           detected_at, expires_at, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW()+INTERVAL'14 days',TRUE)
         RETURNING id`,
        [
          r.report_type, r.title, r.insight_text, r.severity || 'info', r.category,
          r.related_country || null, r.related_company || null, r.related_hs_code || null, r.related_product || null,
          r.relevance_score || 0, r.confidence_score || 0, r.impact_score || 0,
          JSON.stringify(r.recommended_actions || []), r.target_audience || 'export_manager',
          JSON.stringify(r.data_sources || []), JSON.stringify(r.supporting_data || {}),
        ]
      );
      count += res.rowCount;
    }
  });

  return count;
}

// ══════════════════════════════════════════════
// ALERT GENERATION (from intelligence reports)
// ══════════════════════════════════════════════

async function generateAlertsFromReports(reports) {
  // Only generate alerts for high/critical severity reports
  const alertWorthy = reports.filter(r =>
    r.severity === 'critical' || r.severity === 'high' ||
    (r.relevance_score && r.relevance_score >= 70)
  );

  if (alertWorthy.length === 0) return 0;

  const severityToUrgency = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    info: 'low',
  };

  const typeMap = {
    opportunity_alert: 'opportunity',
    buyer_alert: 'trend',
    demand_alert: 'trend',
    supply_gap_alert: 'opportunity',
    price_intelligence: 'price',
  };

  let count = 0;

  await transaction(async (client) => {
    for (const r of alertWorthy) {
      try {
        const res = await client.query(
          `INSERT INTO alerts
            (type, urgency, status, title, message, is_verified, data_source, expires_at)
           VALUES ($1, $2::alert_urgency, 'active', $3, $4, $5, $6, NOW() + INTERVAL '14 days')
           RETURNING id`,
          [
            typeMap[r.report_type] || 'trend',
            severityToUrgency[r.severity] || 'medium',
            r.title,
            r.insight_text,
            (r.confidence_score || 0) >= 70,
            `ai_engine:${r.report_type}`,
          ]
        );
        count += res.rowCount;
      } catch (err) {
        log.warn(`Alert insert failed for "${r.title}": ${err.message}`);
      }
    }
  });

  log.info(`Generated ${count} alerts from ${alertWorthy.length} high-severity reports`);
  return count;
}

function estimateImpact(importValue, indiaShare) {
  const val = parseFloat(importValue || 0);
  const share = parseFloat(indiaShare || 0);
  // High value + low India share = high impact
  let score = 0;
  if (val > 10000000) score += 40; else if (val > 1000000) score += 25; else score += 10;
  if (share < 5) score += 40; else if (share < 15) score += 25; else score += 10;
  score += 20; // base
  return Math.min(score, 100);
}

// ══════════════════════════════════════════════
// QUERY API
// ══════════════════════════════════════════════

export async function getInsights({ limit = 30, type, severity, category, unreadOnly } = {}) {
  let sql = `SELECT * FROM intelligence_reports WHERE is_active = TRUE`;
  const params = [];
  let idx = 1;

  if (type) { sql += ` AND report_type = $${idx++}`; params.push(type); }
  if (severity) { sql += ` AND severity = $${idx++}`; params.push(severity); }
  if (category) { sql += ` AND category = $${idx++}`; params.push(category); }
  if (unreadOnly) { sql += ` AND is_read = FALSE`; }

  sql += ` ORDER BY relevance_score DESC, detected_at DESC LIMIT $${idx}`;
  params.push(limit);

  return (await query(sql, params)).rows;
}

export async function markInsightRead(id) {
  await query(`UPDATE intelligence_reports SET is_read = TRUE, updated_at = NOW() WHERE id = $1`, [id]);
}

export async function getInsightStats() {
  const result = await query(`
    SELECT
      report_type,
      severity,
      COUNT(*) AS count,
      COUNT(*) FILTER (WHERE is_read = FALSE) AS unread
    FROM intelligence_reports
    WHERE is_active = TRUE AND detected_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY report_type, severity
    ORDER BY count DESC
  `);
  return result.rows;
}

export default { generateInsights, getInsights, markInsightRead, getInsightStats };
