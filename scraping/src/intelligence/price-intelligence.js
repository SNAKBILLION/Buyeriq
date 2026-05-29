// ─────────────────────────────────────────────
// BuyerIQ — Price Intelligence Engine
// ─────────────────────────────────────────────
// Generates pricing intelligence from multiple
// sources: marketplace, shipment values, and
// supplier catalogs. Outputs: FOB ranges,
// retail benchmarks, and margin estimates.
// ─────────────────────────────────────────────
import { createLogger } from '../utils/logger.js';
import { query } from '../config/database.js';

const log = createLogger('price-intel');

// ══════════════════════════════════════════════
// PRODUCT CATEGORY → PRICE BENCHMARKS
// ══════════════════════════════════════════════

/**
 * Known FOB price ranges by product category (USD)
 * Source: IndexBox 2024, Senses Lifestyle internal, Alibaba aggregate
 * Avg US import price: $3,749/ton
 */
const FOB_BENCHMARKS = {
  cutting_board: { min: 2.50, max: 12.00, median: 5.50, unit: 'piece' },
  serving_board: { min: 3.00, max: 15.00, median: 7.00, unit: 'piece' },
  utensil_set: { min: 1.50, max: 8.00, median: 3.50, unit: 'set' },
  salad_bowl: { min: 2.00, max: 10.00, median: 4.50, unit: 'piece' },
  rolling_pin: { min: 1.00, max: 5.00, median: 2.50, unit: 'piece' },
  mortar_pestle: { min: 3.00, max: 12.00, median: 6.00, unit: 'set' },
  coaster_set: { min: 1.00, max: 6.00, median: 2.50, unit: 'set' },
  cheese_board: { min: 4.00, max: 18.00, median: 8.00, unit: 'piece' },
  spoon: { min: 0.30, max: 2.00, median: 0.80, unit: 'piece' },
  spatula: { min: 0.40, max: 2.50, median: 1.00, unit: 'piece' },
  plate: { min: 1.50, max: 8.00, median: 3.50, unit: 'piece' },
  tray: { min: 2.50, max: 15.00, median: 6.00, unit: 'piece' },
  generic_wood_kitchenware: { min: 1.50, max: 10.00, median: 4.00, unit: 'piece' },
};

/**
 * Typical retail-to-FOB multipliers by channel
 */
const RETAIL_MULTIPLIERS = {
  amazon: { min: 3.5, typical: 5.0, max: 8.0 },
  walmart: { min: 3.0, typical: 4.5, max: 6.5 },
  wayfair: { min: 4.0, typical: 6.0, max: 10.0 },
  premium_retail: { min: 5.0, typical: 8.0, max: 12.0 },  // Williams-Sonoma, Crate & Barrel
  department_store: { min: 4.0, typical: 6.0, max: 9.0 },   // Target, TJX
  etsy: { min: 4.0, typical: 7.0, max: 15.0 },
  default: { min: 3.5, typical: 5.0, max: 8.0 },
};

// ══════════════════════════════════════════════
// FOB PRICE ESTIMATION
// ══════════════════════════════════════════════

/**
 * Estimate FOB price from retail price
 * @param {number} retailPrice - USD retail price
 * @param {string} platform - Selling platform (amazon, walmart, etc.)
 * @returns {{ fob_min, fob_max, fob_estimated, multiplier }}
 */
export function estimateFOBFromRetail(retailPrice, platform = 'default') {
  if (!retailPrice || retailPrice <= 0) return null;

  const multiplier = RETAIL_MULTIPLIERS[platform] || RETAIL_MULTIPLIERS.default;

  return {
    fob_min: Math.round(retailPrice / multiplier.max * 100) / 100,
    fob_max: Math.round(retailPrice / multiplier.min * 100) / 100,
    fob_estimated: Math.round(retailPrice / multiplier.typical * 100) / 100,
    multiplier_used: multiplier.typical,
    platform,
    retail_price: retailPrice,
  };
}

/**
 * Estimate FOB from shipment value ($/kg)
 * @param {number} valueUsd - Total shipment value
 * @param {number} weightKg - Total weight in kg
 * @returns {{ price_per_kg, price_per_ton, estimated_fob_per_piece }}
 */
export function estimateFOBFromShipment(valueUsd, weightKg) {
  if (!valueUsd || !weightKg || weightKg <= 0) return null;

  const pricePerKg = valueUsd / weightKg;
  const pricePerTon = pricePerKg * 1000;

  // Average wood kitchenware piece: 0.3-1.5 kg
  const avgPieceWeightKg = 0.6;

  return {
    price_per_kg: Math.round(pricePerKg * 100) / 100,
    price_per_ton: Math.round(pricePerTon),
    estimated_fob_per_piece: Math.round(pricePerKg * avgPieceWeightKg * 100) / 100,
    avg_piece_weight_kg: avgPieceWeightKg,
    source: 'shipment_value',
  };
}

// ══════════════════════════════════════════════
// PRODUCT PRICE ANALYSIS
// ══════════════════════════════════════════════

/**
 * Detect which product category a product belongs to (for price benchmarking)
 */
function detectProductCategory(productName) {
  if (!productName) return 'generic_wood_kitchenware';
  const name = productName.toLowerCase();

  const categoryKeywords = {
    cutting_board: ['cutting board', 'chopping board', 'butcher block'],
    serving_board: ['serving board', 'serving tray', 'charcuterie board', 'cheese board set'],
    cheese_board: ['cheese board', 'cheese platter'],
    utensil_set: ['utensil set', 'utensils set', 'spoon set', 'kitchen set'],
    salad_bowl: ['salad bowl', 'mixing bowl', 'fruit bowl', 'wood bowl'],
    rolling_pin: ['rolling pin'],
    mortar_pestle: ['mortar', 'pestle'],
    coaster_set: ['coaster', 'coasters'],
    spoon: ['spoon', 'ladle'],
    spatula: ['spatula', 'turner'],
    plate: ['plate', 'charger', 'dinner plate'],
    tray: ['tray', 'platter'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => name.includes(kw))) return category;
  }

  return 'generic_wood_kitchenware';
}

/**
 * Analyze a batch of retail products for price intelligence
 * @param {Array} products - Retail product records with price, platform, product_name
 * @returns {{ analysis, benchmarks, outliers }}
 */
export function analyzeRetailPrices(products) {
  if (!products || products.length === 0) return { analysis: [], benchmarks: {}, outliers: [] };

  // Group by detected category
  const categoryGroups = new Map();

  for (const product of products) {
    if (!product.price || product.price <= 0) continue;

    const category = detectProductCategory(product.product_name || product.title);
    if (!categoryGroups.has(category)) {
      categoryGroups.set(category, []);
    }
    categoryGroups.get(category).push(product);
  }

  const analysis = [];
  const benchmarks = {};
  const outliers = [];

  for (const [category, items] of categoryGroups) {
    const prices = items.map((p) => p.price).sort((a, b) => a - b);
    const n = prices.length;

    if (n === 0) continue;

    const stats = {
      category,
      count: n,
      min: prices[0],
      max: prices[n - 1],
      median: n % 2 === 0 ? (prices[n / 2 - 1] + prices[n / 2]) / 2 : prices[Math.floor(n / 2)],
      mean: Math.round(prices.reduce((s, p) => s + p, 0) / n * 100) / 100,
      p25: prices[Math.floor(n * 0.25)],
      p75: prices[Math.floor(n * 0.75)],
    };

    // FOB estimation from median retail
    const fobBenchmark = FOB_BENCHMARKS[category] || FOB_BENCHMARKS.generic_wood_kitchenware;
    const fobEstimate = estimateFOBFromRetail(stats.median, items[0]?.platform);

    // Margin estimation
    const marginEstimate = fobEstimate ? {
      gross_margin_pct: Math.round((1 - fobEstimate.fob_estimated / stats.median) * 100),
      landed_cost_estimate: Math.round(fobEstimate.fob_estimated * 1.35 * 100) / 100, // FOB + ~35% (freight, duty, etc.)
      retail_margin_pct: Math.round((1 - fobEstimate.fob_estimated * 1.35 / stats.median) * 100),
    } : null;

    analysis.push({
      ...stats,
      fob_benchmark: fobBenchmark,
      fob_estimate: fobEstimate,
      margin_estimate: marginEstimate,
      platforms: [...new Set(items.map((p) => p.platform))],
    });

    benchmarks[category] = {
      retail_median: stats.median,
      retail_range: [stats.p25, stats.p75],
      fob_estimated: fobEstimate?.fob_estimated,
      fob_benchmark: fobBenchmark.median,
    };

    // Detect outliers (below P10 or above P90)
    const p10 = prices[Math.floor(n * 0.10)];
    const p90 = prices[Math.floor(n * 0.90)];
    for (const item of items) {
      if (item.price < p10 || item.price > p90) {
        outliers.push({
          ...item,
          category,
          outlier_type: item.price < p10 ? 'low' : 'high',
          category_median: stats.median,
        });
      }
    }
  }

  log.info(`Price analysis: ${analysis.length} categories, ${products.length} products`, {
    categories: analysis.map((a) => `${a.category}(${a.count})`),
  });

  return { analysis, benchmarks, outliers };
}

/**
 * Analyze shipment-based pricing across routes
 * @param {Array} shipments - Shipment records with value_usd, weight_kg, origin, destination
 */
export function analyzeShipmentPricing(shipments) {
  const routeGroups = new Map();

  for (const s of shipments) {
    if (!s.value_usd || !s.weight_kg || s.weight_kg <= 0) continue;

    const route = `${s.origin_country || 'unknown'}→${s.destination_country || 'unknown'}`;
    if (!routeGroups.has(route)) {
      routeGroups.set(route, []);
    }
    routeGroups.get(route).push({
      pricePerKg: s.value_usd / s.weight_kg,
      value: s.value_usd,
      weight: s.weight_kg,
      date: s.ship_date,
    });
  }

  const routeAnalysis = [];

  for (const [route, data] of routeGroups) {
    const prices = data.map((d) => d.pricePerKg).sort((a, b) => a - b);
    const n = prices.length;
    if (n === 0) continue;

    routeAnalysis.push({
      route,
      shipment_count: n,
      avg_price_per_kg: Math.round(prices.reduce((s, p) => s + p, 0) / n * 100) / 100,
      median_price_per_kg: Math.round(prices[Math.floor(n / 2)] * 100) / 100,
      min_price_per_kg: Math.round(prices[0] * 100) / 100,
      max_price_per_kg: Math.round(prices[n - 1] * 100) / 100,
      total_value: Math.round(data.reduce((s, d) => s + d.value, 0)),
      total_weight_kg: Math.round(data.reduce((s, d) => s + d.weight, 0)),
    });
  }

  return routeAnalysis.sort((a, b) => b.shipment_count - a.shipment_count);
}

// ══════════════════════════════════════════════
// DB-BACKED PRICE INTELLIGENCE (queries live data)
// ══════════════════════════════════════════════

/**
 * Calculate margin potential from live DB data.
 * Combines retail_product_data, shipment_records, and price_data
 * to produce: retail benchmark → estimated FOB → landed cost → margin %.
 *
 * @param {string} productCategory - e.g., 'cutting_board' or null for all
 * @param {string} platform - e.g., 'amazon' or null for all
 * @returns {Array} Per-category margin analysis
 */
export async function calculateMarginPotential(productCategory = null, platform = null) {
  // 1. Get retail price benchmarks from marketplace data
  let retailSql = `
    SELECT
      COALESCE(category, 'wood_kitchenware') AS category,
      marketplace AS platform,
      COUNT(*) AS product_count,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) AS p25_price,
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price) AS median_price,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) AS p75_price,
      AVG(price) AS avg_price,
      AVG(rating) AS avg_rating,
      SUM(COALESCE(review_count, 0)) AS total_reviews
    FROM retail_product_data
    WHERE price > 0 AND price < 500
      AND scraped_at >= CURRENT_DATE - INTERVAL '60 days'
  `;
  const params = [];
  let idx = 1;
  if (productCategory) { retailSql += ` AND category = $${idx++}`; params.push(productCategory); }
  if (platform) { retailSql += ` AND marketplace = $${idx++}`; params.push(platform); }
  retailSql += ` GROUP BY COALESCE(category, 'wood_kitchenware'), marketplace HAVING COUNT(*) >= 3`;

  const retailResult = await query(retailSql, params);

  // 2. Get FOB signals from shipment data
  const fobResult = await query(`
    SELECT
      AVG(CASE WHEN weight_kg > 0 THEN estimated_value_usd / weight_kg ELSE NULL END) AS avg_fob_per_kg,
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY CASE WHEN weight_kg > 0 THEN estimated_value_usd / weight_kg ELSE NULL END
      ) AS median_fob_per_kg,
      COUNT(*) AS shipment_count
    FROM shipment_records
    WHERE weight_kg > 0 AND estimated_value_usd > 0
      AND origin_country IN ('India', 'IND', 'IN')
      AND ship_date >= CURRENT_DATE - INTERVAL '12 months'
  `);

  const indiaFob = fobResult.rows[0] || {};
  const avgFobPerKg = parseFloat(indiaFob.avg_fob_per_kg || 0);
  const medianFobPerKg = parseFloat(indiaFob.median_fob_per_kg || 0);
  const avgPieceWeight = 0.6; // kg per typical piece

  // 3. Build margin analysis per category
  const analysis = retailResult.rows.map((row) => {
    const retailMedian = parseFloat(row.median_price || 0);
    const retailP25 = parseFloat(row.p25_price || 0);
    const retailP75 = parseFloat(row.p75_price || 0);
    const platformStr = row.platform || 'default';

    // FOB estimate: use shipment data if available, else retail-to-FOB multiplier
    const multiplier = RETAIL_MULTIPLIERS[platformStr] || RETAIL_MULTIPLIERS.default;
    const fobFromRetail = retailMedian / multiplier.typical;
    const fobFromShipment = medianFobPerKg > 0 ? medianFobPerKg * avgPieceWeight : null;
    const estimatedFob = fobFromShipment || fobFromRetail;

    // Landed cost = FOB + ~35% (freight, insurance, duty, customs, handling)
    const landedCost = estimatedFob * 1.35;

    // Margin = (retail - landed) / retail
    const grossMarginPct = retailMedian > 0
      ? Math.round((1 - landedCost / retailMedian) * 100)
      : null;

    return {
      category: row.category,
      platform: platformStr,
      product_count: parseInt(row.product_count, 10),

      // Retail benchmarks
      retail_p25: Math.round(retailP25 * 100) / 100,
      retail_median: Math.round(retailMedian * 100) / 100,
      retail_p75: Math.round(retailP75 * 100) / 100,
      avg_rating: Math.round(parseFloat(row.avg_rating || 0) * 100) / 100,
      total_reviews: parseInt(row.total_reviews || 0, 10),

      // FOB estimates
      estimated_fob: Math.round(estimatedFob * 100) / 100,
      fob_source: fobFromShipment ? 'india_shipment_data' : 'retail_multiplier',
      fob_from_shipment: fobFromShipment ? Math.round(fobFromShipment * 100) / 100 : null,
      fob_from_multiplier: Math.round(fobFromRetail * 100) / 100,
      retail_multiplier_used: multiplier.typical,

      // Margin
      landed_cost_estimate: Math.round(landedCost * 100) / 100,
      gross_margin_pct: grossMarginPct,
      margin_tier: grossMarginPct >= 60 ? 'excellent'
        : grossMarginPct >= 45 ? 'good'
        : grossMarginPct >= 30 ? 'moderate'
        : grossMarginPct >= 0 ? 'thin' : 'negative',

      // India-specific
      india_fob_per_kg: medianFobPerKg > 0 ? Math.round(medianFobPerKg * 100) / 100 : null,
      india_shipment_count: parseInt(indiaFob.shipment_count || 0, 10),
    };
  });

  log.info(`Margin analysis: ${analysis.length} category-platform combos`, {
    withShipmentFob: analysis.filter((a) => a.fob_source === 'india_shipment_data').length,
  });

  return analysis;
}

/**
 * Get a compact price intelligence dashboard for the API
 */
export async function getPriceIntelligenceSummary() {
  const [margins, recentPrices, fobTrend] = await Promise.all([
    calculateMarginPotential(),
    query(`
      SELECT marketplace, category, price_type,
             AVG(price_usd) AS avg_price, COUNT(*) AS data_points,
             MAX(recorded_at) AS last_recorded
      FROM price_data
      WHERE recorded_at >= CURRENT_DATE - INTERVAL '30 days' AND price_usd > 0
      GROUP BY marketplace, category, price_type
      ORDER BY data_points DESC LIMIT 20
    `),
    query(`
      SELECT
        DATE_TRUNC('month', ship_date) AS month,
        AVG(CASE WHEN weight_kg > 0 THEN estimated_value_usd / weight_kg ELSE NULL END) AS avg_fob_per_kg,
        COUNT(*) AS shipments
      FROM shipment_records
      WHERE origin_country IN ('India', 'IND', 'IN')
        AND weight_kg > 0 AND estimated_value_usd > 0
        AND ship_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', ship_date)
      ORDER BY month
    `),
  ]);

  return {
    margin_analysis: margins,
    recent_price_data: recentPrices.rows,
    india_fob_trend: fobTrend.rows.map((r) => ({
      month: r.month,
      avg_fob_per_kg: Math.round(parseFloat(r.avg_fob_per_kg || 0) * 100) / 100,
      shipments: parseInt(r.shipments, 10),
    })),
  };
}

export default {
  estimateFOBFromRetail, estimateFOBFromShipment,
  analyzeRetailPrices, analyzeShipmentPricing,
  calculateMarginPotential, getPriceIntelligenceSummary,
  FOB_BENCHMARKS, RETAIL_MULTIPLIERS,
};
