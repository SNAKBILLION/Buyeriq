// ─────────────────────────────────────────────
// BuyerIQ — Confidence Scoring Engine
// ─────────────────────────────────────────────
// Every record gets a confidence_score (0-100)
// based on source reliability, data completeness,
// frequency of appearance, and cross-verification.
// ─────────────────────────────────────────────
import { createLogger } from '../utils/logger.js';

const log = createLogger('confidence');

// ══════════════════════════════════════════════
// SOURCE RELIABILITY SCORES (base weight)
// ══════════════════════════════════════════════

const SOURCE_RELIABILITY = {
  // Official government / international org APIs
  comtrade: 95,
  usitc: 95,
  eurostat: 95,
  wto: 90,
  dgft: 90,
  customs: 90,

  // Financial / ECB data
  frankfurter: 95,
  ecb: 95,

  // Established data aggregators
  indexbox: 85,
  volza: 80,
  oec: 80,
  tradingeconomics: 80,

  // Public customs records
  importyeti: 70,
  panjiva: 75,
  importgenius: 75,

  // Marketplace / retail (prices can vary)
  amazon: 65,
  walmart: 65,
  wayfair: 60,
  etsy: 55,
  ebay: 50,

  // Supplier directories
  alibaba: 55,
  globalsources: 55,
  madeinchina: 50,
  indiamart: 50,

  // Scraped / inferred
  scraper: 40,
  inferred: 30,
  manual: 70,

  // Default
  unknown: 25,
};

// ══════════════════════════════════════════════
// COMPLETENESS WEIGHTS BY ENTITY TYPE
// ══════════════════════════════════════════════

const COMPLETENESS_FIELDS = {
  company: {
    required: ['company_name'],
    important: ['country', 'website', 'industry'],
    optional: ['estimated_revenue', 'buyer_type', 'product_categories'],
  },
  supplier: {
    required: ['company_name', 'country'],
    important: ['product_categories', 'certifications', 'source_platform'],
    optional: ['year_established', 'employee_count', 'annual_revenue', 'website', 'contact_email'],
  },
  shipment: {
    required: ['importer_name', 'exporter_name'],
    important: ['hs_code', 'shipment_date', 'origin_country', 'destination_country'],
    optional: ['weight_kg', 'value_usd', 'product_description', 'port_of_entry', 'container_type'],
  },
  trade_stat: {
    required: ['reporter_code', 'partner_code', 'hs_code', 'year'],
    important: ['trade_value_usd', 'trade_flow'],
    optional: ['net_weight_kg', 'quantity'],
  },
  retail_product: {
    required: ['product_name', 'platform'],
    important: ['price', 'product_url'],
    optional: ['rating', 'review_count', 'seller_name', 'category', 'image_url'],
  },
  price_data: {
    required: ['price_usd', 'source_platform'],
    important: ['product_type', 'price_type'],
    optional: ['source_url', 'currency_original'],
  },
};

// ══════════════════════════════════════════════
// SCORING FUNCTIONS
// ══════════════════════════════════════════════

/**
 * Calculate confidence score for a record
 *
 * @param {object} record - The data record
 * @param {string} entityType - 'company', 'supplier', 'shipment', 'trade_stat', 'retail_product', 'price_data'
 * @param {object} options - Additional scoring factors
 * @returns {{ score, factors, level }}
 */
export function calculateConfidence(record, entityType, options = {}) {
  const factors = [];
  let score = 0;

  // ── Factor 1: Source Reliability (0-35 points) ──
  const source = (record.source || record._source || record.source_platform || 'unknown').toLowerCase();
  const sourceScore = (SOURCE_RELIABILITY[source] || SOURCE_RELIABILITY.unknown) * 0.35;
  score += sourceScore;
  factors.push({ factor: 'source_reliability', source, points: Math.round(sourceScore) });

  // ── Factor 2: Data Completeness (0-30 points) ──
  const fields = COMPLETENESS_FIELDS[entityType];
  if (fields) {
    const completeness = calculateCompleteness(record, fields);
    const completenessScore = completeness.score * 0.30;
    score += completenessScore;
    factors.push({
      factor: 'completeness',
      score: completeness.score,
      filled: completeness.filled,
      total: completeness.total,
      points: Math.round(completenessScore),
    });
  }

  // ── Factor 3: Recency (0-15 points) ──
  const recencyScore = calculateRecencyScore(record) * 0.15;
  score += recencyScore;
  factors.push({ factor: 'recency', points: Math.round(recencyScore) });

  // ── Factor 4: Cross-verification (0-10 points) ──
  if (options.appearsInSources) {
    const crossScore = Math.min(options.appearsInSources, 5) * 2;
    score += crossScore;
    factors.push({ factor: 'cross_verification', sources: options.appearsInSources, points: crossScore });
  }

  // ── Factor 5: Entity normalization match (0-10 points) ──
  if (options.aliasMatched) {
    score += 10;
    factors.push({ factor: 'alias_matched', points: 10 });
  } else if (options.normalizedSuccessfully) {
    score += 5;
    factors.push({ factor: 'normalized', points: 5 });
  }

  // Clamp to 0-100
  const finalScore = Math.min(Math.max(Math.round(score), 0), 100);

  return {
    score: finalScore,
    level: scoreToLevel(finalScore),
    factors,
  };
}

/**
 * Score data completeness (0-100)
 */
function calculateCompleteness(record, fields) {
  let filled = 0;
  let total = 0;

  // Required fields: 3 points each
  for (const f of fields.required) {
    total += 3;
    if (hasValue(record[f])) filled += 3;
  }

  // Important fields: 2 points each
  for (const f of fields.important) {
    total += 2;
    if (hasValue(record[f])) filled += 2;
  }

  // Optional fields: 1 point each
  for (const f of fields.optional) {
    total += 1;
    if (hasValue(record[f])) filled += 1;
  }

  return {
    score: total > 0 ? Math.round((filled / total) * 100) : 0,
    filled,
    total,
  };
}

/**
 * Score based on data recency (0-100)
 * Newer data = higher score
 */
function calculateRecencyScore(record) {
  const dateFields = ['shipment_date', 'scraped_at', 'recorded_at', 'updated_at', '_fetchedAt'];
  let latestDate = null;

  for (const field of dateFields) {
    if (record[field]) {
      const d = new Date(record[field]);
      if (!isNaN(d.getTime()) && (!latestDate || d > latestDate)) {
        latestDate = d;
      }
    }
  }

  if (!latestDate) return 50; // Unknown date → middle score

  const daysSince = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince <= 1) return 100;
  if (daysSince <= 7) return 90;
  if (daysSince <= 30) return 80;
  if (daysSince <= 90) return 60;
  if (daysSince <= 365) return 40;
  return 20;
}

/**
 * Convert numeric score to confidence level label
 */
function scoreToLevel(score) {
  if (score >= 85) return 'VERIFIED';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  if (score >= 30) return 'LOW';
  return 'UNVERIFIED';
}

function hasValue(val) {
  if (val === null || val === undefined || val === '') return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
}

// ══════════════════════════════════════════════
// BATCH SCORING
// ══════════════════════════════════════════════

/**
 * Score a batch of records
 */
export function scoreBatch(records, entityType, options = {}) {
  const stats = { total: 0, verified: 0, high: 0, medium: 0, low: 0, unverified: 0, avgScore: 0 };
  let totalScore = 0;

  const scored = records.map((record) => {
    stats.total++;
    const result = calculateConfidence(record, entityType, options);
    totalScore += result.score;

    stats[result.level.toLowerCase()]++;

    return {
      ...record,
      confidence_score: result.score,
      confidence_level: result.level,
      confidence_factors: result.factors,
    };
  });

  stats.avgScore = stats.total > 0 ? Math.round(totalScore / stats.total) : 0;

  log.info(`Confidence scoring: ${stats.total} ${entityType} records`, {
    avg: stats.avgScore,
    verified: stats.verified,
    high: stats.high,
    medium: stats.medium,
    low: stats.low,
  });

  return { records: scored, stats };
}

export default {
  calculateConfidence, scoreBatch, SOURCE_RELIABILITY,
};
