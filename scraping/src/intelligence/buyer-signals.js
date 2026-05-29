// ─────────────────────────────────────────────
// BuyerIQ — Buyer Signal Detection
// ─────────────────────────────────────────────
// Detects potential buyers from shipment records,
// marketplace sellers, and procurement signals.
// Generates buyer profiles with scoring.
// ─────────────────────────────────────────────
import { createLogger } from '../utils/logger.js';
import { normalizeCompanyName, normalizeCountry } from './entity-normalizer.js';
import { isRelevantHSCode } from './hs-code-mapper.js';

const log = createLogger('buyer-signals');

// ══════════════════════════════════════════════
// BUYER TYPE CLASSIFICATION
// ══════════════════════════════════════════════

const BUYER_TYPE_KEYWORDS = {
  retailer: [
    'retail', 'store', 'shop', 'mart', 'bazaar', 'boutique',
    'home goods', 'home decor', 'furnishing', 'department store',
  ],
  distributor: [
    'distribution', 'distributor', 'wholesale', 'supply chain',
    'logistics', 'trading company', 'import export',
  ],
  ecommerce: [
    'online', 'ecommerce', 'e-commerce', 'marketplace', 'digital',
    '.com', 'direct to consumer', 'dtc', 'd2c',
  ],
  hospitality: [
    'hotel', 'restaurant', 'resort', 'hospitality', 'catering',
    'food service', 'cafe', 'bistro',
  ],
  corporate: [
    'corporate gifts', 'promotional', 'branding', 'custom',
    'private label', 'white label',
  ],
};

/**
 * Classify buyer type from available signals
 */
function classifyBuyerType(companyName, description, website) {
  const text = [companyName, description, website].filter(Boolean).join(' ').toLowerCase();

  for (const [type, keywords] of Object.entries(BUYER_TYPE_KEYWORDS)) {
    const matchCount = keywords.filter((kw) => text.includes(kw)).length;
    if (matchCount >= 1) return type;
  }

  return 'unknown';
}

// ══════════════════════════════════════════════
// SHIPMENT-BASED BUYER SIGNALS
// ══════════════════════════════════════════════

/**
 * Analyze shipment records to generate buyer signals.
 * Groups by importer, calculates volume/frequency/sourcing patterns.
 *
 * @param {Array} shipments - Cleaned shipment records
 * @returns {Array} Buyer signal objects
 */
export function detectBuyersFromShipments(shipments) {
  if (!shipments || shipments.length === 0) return [];

  // Group shipments by importer
  const importerMap = new Map();

  for (const shipment of shipments) {
    const name = shipment.importer_name;
    if (!name) continue;

    const { canonical } = normalizeCompanyName(name);
    const key = canonical.toLowerCase();

    if (!importerMap.has(key)) {
      importerMap.set(key, {
        company_name: canonical,
        country: shipment.destination_country,
        shipments: [],
        hs_codes: new Set(),
        origin_countries: new Set(),
        exporters: new Set(),
      });
    }

    const buyer = importerMap.get(key);
    buyer.shipments.push(shipment);
    if (shipment.hs_code) buyer.hs_codes.add(shipment.hs_code);
    if (shipment.origin_country) buyer.origin_countries.add(shipment.origin_country);
    if (shipment.exporter_name) buyer.exporters.add(shipment.exporter_name);
  }

  // Generate signals for each importer
  const signals = [];

  for (const [, data] of importerMap) {
    const { shipments: records } = data;

    // Calculate frequency
    const dates = records
      .map((r) => r.shipment_date)
      .filter(Boolean)
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a - b);

    const frequency = calculateFrequency(dates);

    // Calculate volume
    const totalWeight = records.reduce((sum, r) => sum + (parseFloat(r.weight_kg) || 0), 0);
    const totalValue = records.reduce((sum, r) => sum + (parseFloat(r.value_usd) || 0), 0);

    // Check HS code relevance
    const relevantHS = [...data.hs_codes].filter(isRelevantHSCode);
    const isWoodBuyer = relevantHS.length > 0;

    // Source India?
    const sourcesFromIndia = data.origin_countries.has('India') ||
      data.origin_countries.has('IN') ||
      data.origin_countries.has('IND');

    // Volume tier
    const volumeTier = totalWeight > 50000 ? 'HIGH'
      : totalWeight > 10000 ? 'MEDIUM'
      : totalWeight > 1000 ? 'LOW'
      : 'MICRO';

    const signal = {
      company_name: data.company_name,
      country: data.country,
      buyer_type: classifyBuyerType(data.company_name, '', ''),

      // Volume signals
      total_shipments: records.length,
      total_weight_kg: Math.round(totalWeight),
      total_value_usd: Math.round(totalValue),
      volume_tier: volumeTier,

      // Frequency signals
      frequency: frequency.label,
      avg_days_between_shipments: frequency.avgDays,
      first_shipment: dates.length > 0 ? dates[0].toISOString().split('T')[0] : null,
      last_shipment: dates.length > 0 ? dates[dates.length - 1].toISOString().split('T')[0] : null,

      // Sourcing signals
      sourcing_countries: [...data.origin_countries],
      sourcing_country_count: data.origin_countries.size,
      sources_from_india: sourcesFromIndia,
      supplier_count: data.exporters.size,
      top_suppliers: [...data.exporters].slice(0, 5),

      // Product signals
      hs_codes: [...data.hs_codes],
      relevant_hs_codes: relevantHS,
      is_wood_kitchenware_buyer: isWoodBuyer,

      // Scoring
      buyer_score: calculateBuyerScore({
        shipments: records.length,
        volumeTier,
        frequency: frequency.label,
        isWoodBuyer,
        sourcesFromIndia,
        supplierCount: data.exporters.size,
      }),

      signal_source: 'shipment_analysis',
      detected_at: new Date().toISOString(),
    };

    signals.push(signal);
  }

  // Sort by score descending
  signals.sort((a, b) => b.buyer_score - a.buyer_score);

  log.info(`Buyer signals from shipments: ${signals.length} buyers detected`, {
    highScore: signals.filter((s) => s.buyer_score >= 70).length,
    woodBuyers: signals.filter((s) => s.is_wood_kitchenware_buyer).length,
  });

  return signals;
}

// ══════════════════════════════════════════════
// MARKETPLACE-BASED BUYER SIGNALS
// ══════════════════════════════════════════════

/**
 * Detect potential buyers from marketplace seller data.
 * Sellers with high-volume wood kitchenware listings
 * are likely sourcing from manufacturers.
 *
 * @param {Array} products - Retail product records
 * @returns {Array} Buyer signal objects
 */
export function detectBuyersFromMarketplace(products) {
  if (!products || products.length === 0) return [];

  // Group by seller
  const sellerMap = new Map();

  for (const product of products) {
    const seller = product.seller_name || product.brand;
    if (!seller) continue;

    const key = seller.toLowerCase().trim();
    if (!sellerMap.has(key)) {
      sellerMap.set(key, {
        seller_name: seller,
        platform: product.platform,
        products: [],
        categories: new Set(),
        price_sum: 0,
        price_count: 0,
      });
    }

    const s = sellerMap.get(key);
    s.products.push(product);
    if (product.category) s.categories.add(product.category);
    if (product.price) {
      s.price_sum += product.price;
      s.price_count++;
    }
  }

  const signals = [];

  for (const [, data] of sellerMap) {
    // Only consider sellers with multiple products (likely bulk sourcing)
    if (data.products.length < 3) continue;

    const avgPrice = data.price_count > 0 ? data.price_sum / data.price_count : 0;
    const avgRating = data.products.reduce((s, p) => s + (p.rating || 0), 0) / data.products.length;
    const totalReviews = data.products.reduce((s, p) => s + (p.review_count || 0), 0);

    const signal = {
      company_name: data.seller_name,
      buyer_type: 'marketplace_seller',
      platform: data.platform,

      product_count: data.products.length,
      categories: [...data.categories],
      avg_price_usd: Math.round(avgPrice * 100) / 100,
      avg_rating: Math.round(avgRating * 100) / 100,
      total_reviews: totalReviews,

      // Estimated volume (reviews as proxy for sales)
      estimated_monthly_units: estimateMonthlyUnits(totalReviews, data.products.length),

      buyer_score: calculateMarketplaceScore({
        productCount: data.products.length,
        totalReviews,
        avgRating,
        avgPrice,
      }),

      signal_source: 'marketplace_analysis',
      detected_at: new Date().toISOString(),
    };

    signals.push(signal);
  }

  signals.sort((a, b) => b.buyer_score - a.buyer_score);

  log.info(`Buyer signals from marketplace: ${signals.length} sellers detected`);
  return signals;
}

// ══════════════════════════════════════════════
// SCORING FUNCTIONS
// ══════════════════════════════════════════════

function calculateBuyerScore({ shipments, volumeTier, frequency, isWoodBuyer, sourcesFromIndia, supplierCount }) {
  let score = 0;

  // Shipment volume (max 30)
  score += Math.min(shipments * 2, 30);

  // Volume tier (max 20)
  const tierScores = { HIGH: 20, MEDIUM: 15, LOW: 10, MICRO: 5 };
  score += tierScores[volumeTier] || 0;

  // Frequency (max 15)
  const freqScores = { weekly: 15, biweekly: 12, monthly: 10, quarterly: 7, annual: 3, irregular: 2 };
  score += freqScores[frequency] || 0;

  // Wood kitchenware buyer (max 20)
  if (isWoodBuyer) score += 20;

  // Sources from India (max 10)
  if (sourcesFromIndia) score += 10;

  // Supplier diversity (max 5)
  score += Math.min(supplierCount, 5);

  return Math.min(Math.round(score), 100);
}

function calculateMarketplaceScore({ productCount, totalReviews, avgRating, avgPrice }) {
  let score = 0;

  score += Math.min(productCount * 3, 25);
  score += Math.min(Math.log10(totalReviews + 1) * 10, 25);
  score += avgRating >= 4.0 ? 15 : avgRating >= 3.5 ? 10 : 5;
  score += avgPrice >= 30 ? 15 : avgPrice >= 15 ? 10 : 5;
  // Higher price = likely sourcing quality products

  return Math.min(Math.round(score), 100);
}

function calculateFrequency(dates) {
  if (dates.length < 2) return { label: 'insufficient_data', avgDays: null };

  const gaps = [];
  for (let i = 1; i < dates.length; i++) {
    const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
    if (diff > 0) gaps.push(diff);
  }

  if (gaps.length === 0) return { label: 'insufficient_data', avgDays: null };

  const avgDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);

  let label;
  if (avgDays <= 10) label = 'weekly';
  else if (avgDays <= 20) label = 'biweekly';
  else if (avgDays <= 45) label = 'monthly';
  else if (avgDays <= 120) label = 'quarterly';
  else if (avgDays <= 400) label = 'annual';
  else label = 'irregular';

  return { label, avgDays };
}

function estimateMonthlyUnits(totalReviews, productCount) {
  // Industry estimate: ~1-3% of buyers leave reviews
  // Conservative: assume 2% review rate, 12-month spread
  const estimatedSales = totalReviews / 0.02;
  const monthlyEstimate = estimatedSales / 12;
  return Math.round(monthlyEstimate);
}

export default {
  detectBuyersFromShipments, detectBuyersFromMarketplace,
  classifyBuyerType,
};
