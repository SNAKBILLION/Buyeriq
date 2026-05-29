// ─────────────────────────────────────────────
// BuyerIQ — Supplier Classification Engine
// ─────────────────────────────────────────────
// Classifies suppliers into categories:
// manufacturer vs trader, product capabilities,
// export readiness, and certification signals.
// ─────────────────────────────────────────────
import { createLogger } from '../utils/logger.js';

const log = createLogger('supplier-classifier');

// ══════════════════════════════════════════════
// SUPPLIER TYPE CLASSIFICATION
// ══════════════════════════════════════════════

const MANUFACTURER_SIGNALS = [
  'manufacturer', 'manufacturing', 'factory', 'production',
  'workshop', 'mill', 'plant', 'oem', 'odm', 'made to order',
  'custom manufacturing', 'own factory', 'in-house production',
  'production capacity', 'production line', 'cnc', 'lathe',
];

const TRADER_SIGNALS = [
  'trader', 'trading', 'trading company', 'import export',
  'sourcing agent', 'buying agent', 'broker', 'middleman',
  'procurement', 'supply chain', 'logistics', 'consolidator',
  'general trading', 'commodity', 'reseller',
];

const ARTISAN_SIGNALS = [
  'handmade', 'handcrafted', 'artisan', 'craft', 'craftsman',
  'hand carved', 'hand painted', 'folk art', 'tribal',
  'cottage industry', 'small batch', 'bespoke',
];

/**
 * Classify supplier as manufacturer, trader, or artisan
 * @param {object} supplier - { company_name, product_categories, certifications, employee_count, ... }
 * @returns {{ type, confidence, signals }}
 */
export function classifySupplierType(supplier) {
  const text = [
    supplier.company_name,
    ...(supplier.product_categories || []),
    supplier.description,
    supplier.annual_revenue,
  ].filter(Boolean).join(' ').toLowerCase();

  let manufacturerScore = 0;
  let traderScore = 0;
  let artisanScore = 0;
  const matchedSignals = [];

  // Keyword scoring
  for (const kw of MANUFACTURER_SIGNALS) {
    if (text.includes(kw)) {
      manufacturerScore += 2;
      matchedSignals.push({ signal: kw, type: 'manufacturer' });
    }
  }

  for (const kw of TRADER_SIGNALS) {
    if (text.includes(kw)) {
      traderScore += 2;
      matchedSignals.push({ signal: kw, type: 'trader' });
    }
  }

  for (const kw of ARTISAN_SIGNALS) {
    if (text.includes(kw)) {
      artisanScore += 2;
      matchedSignals.push({ signal: kw, type: 'artisan' });
    }
  }

  // Employee count heuristic
  const employees = parseEmployeeCount(supplier.employee_count);
  if (employees !== null) {
    if (employees >= 100) {
      manufacturerScore += 3;
      matchedSignals.push({ signal: `${employees} employees`, type: 'manufacturer' });
    } else if (employees >= 20) {
      manufacturerScore += 1;
    } else if (employees < 10) {
      artisanScore += 1;
    }
  }

  // Certification signals
  const certs = supplier.certifications || [];
  const certStr = certs.join(' ').toLowerCase();
  if (certStr.includes('iso') || certStr.includes('fssc') || certStr.includes('brc')) {
    manufacturerScore += 3;
    matchedSignals.push({ signal: 'ISO/quality certification', type: 'manufacturer' });
  }
  if (certStr.includes('fsc') || certStr.includes('pefc')) {
    manufacturerScore += 2;
    matchedSignals.push({ signal: 'Forest certification (FSC/PEFC)', type: 'manufacturer' });
  }

  // Trade assurance (Alibaba)
  if (supplier.trade_assurance || supplier.is_verified) {
    manufacturerScore += 1;
  }

  // Determine type
  const scores = {
    manufacturer: manufacturerScore,
    trader: traderScore,
    artisan: artisanScore,
  };

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const [bestType, bestScore] = sorted[0];
  const [, secondScore] = sorted[1];

  const totalScore = manufacturerScore + traderScore + artisanScore;
  const confidence = totalScore > 0
    ? Math.min((bestScore / totalScore) * 0.8 + 0.2, 0.95)
    : 0.3;

  return {
    type: bestScore > 0 ? bestType : 'unknown',
    confidence: Math.round(confidence * 100) / 100,
    scores,
    signals: matchedSignals,
  };
}

// ══════════════════════════════════════════════
// PRODUCT CATEGORY CLASSIFICATION
// ══════════════════════════════════════════════

const PRODUCT_CATEGORY_MAP = {
  'cutting_boards': ['cutting board', 'chopping board', 'butcher block', 'cheese board', 'bread board', 'carving board'],
  'serving_ware': ['serving board', 'serving tray', 'platter', 'cheese platter', 'charcuterie'],
  'utensils': ['spoon', 'fork', 'spatula', 'ladle', 'turner', 'tongs', 'utensil set'],
  'bowls': ['bowl', 'salad bowl', 'mixing bowl', 'fruit bowl', 'soup bowl'],
  'storage': ['container', 'canister', 'jar', 'box', 'organizer', 'rack'],
  'decorative': ['decor', 'ornament', 'figurine', 'wall art', 'sculpture', 'frame'],
  'tableware': ['plate', 'coaster', 'trivet', 'napkin holder', 'charger', 'placemat'],
  'specialty': ['rolling pin', 'mortar', 'pestle', 'wine rack', 'knife block', 'cake stand'],
};

/**
 * Classify supplier's product categories from their product list
 */
export function classifyProductCategories(productList) {
  if (!productList || productList.length === 0) return [];

  const text = (Array.isArray(productList) ? productList.join(' ') : String(productList)).toLowerCase();
  const matched = [];

  for (const [category, keywords] of Object.entries(PRODUCT_CATEGORY_MAP)) {
    const matchCount = keywords.filter((kw) => text.includes(kw)).length;
    if (matchCount > 0) {
      matched.push({
        category,
        matchCount,
        matchedKeywords: keywords.filter((kw) => text.includes(kw)),
      });
    }
  }

  return matched.sort((a, b) => b.matchCount - a.matchCount);
}

// ══════════════════════════════════════════════
// EXPORT CAPABILITY SCORING
// ══════════════════════════════════════════════

/**
 * Score a supplier's export capability / readiness
 * 0-100 scale
 */
export function scoreExportCapability(supplier) {
  let score = 0;
  const factors = [];

  // Years in business
  const years = supplier.years_on_platform || supplier.years_in_business;
  if (years) {
    const yrs = parseInt(years, 10);
    if (yrs >= 10) { score += 15; factors.push('10+ years experience'); }
    else if (yrs >= 5) { score += 10; factors.push('5+ years experience'); }
    else if (yrs >= 2) { score += 5; factors.push('2+ years experience'); }
  }

  // Employee count
  const employees = parseEmployeeCount(supplier.employee_count);
  if (employees >= 200) { score += 15; factors.push('200+ employees'); }
  else if (employees >= 50) { score += 10; factors.push('50+ employees'); }
  else if (employees >= 10) { score += 5; factors.push('10+ employees'); }

  // Certifications
  const certs = (supplier.certifications || []).join(' ').toLowerCase();
  if (certs.includes('fsc')) { score += 10; factors.push('FSC certified'); }
  if (certs.includes('iso')) { score += 8; factors.push('ISO certified'); }
  if (certs.includes('bsci') || certs.includes('sedex')) { score += 7; factors.push('Social audit'); }
  if (certs.includes('fda')) { score += 5; factors.push('FDA compliant'); }

  // Trade assurance / verification
  if (supplier.trade_assurance || supplier.is_verified) {
    score += 8;
    factors.push('Verified supplier');
  }

  // Response rate
  const responseRate = parseFloat(supplier.response_rate);
  if (responseRate >= 90) { score += 7; factors.push('High response rate'); }
  else if (responseRate >= 70) { score += 4; factors.push('Good response rate'); }

  // Revenue signal
  if (supplier.annual_revenue) {
    const rev = supplier.annual_revenue.toLowerCase();
    if (rev.includes('above') || rev.includes('50 million') || rev.includes('100 million')) {
      score += 12;
      factors.push('High revenue');
    } else if (rev.includes('10 million') || rev.includes('5 million')) {
      score += 8;
      factors.push('Medium revenue');
    }
  }

  // Country bonus (known export hubs)
  const country = (supplier.country || '').toLowerCase();
  const exportHubs = ['china', 'india', 'vietnam', 'indonesia', 'thailand', 'poland'];
  if (exportHubs.some((c) => country.includes(c))) {
    score += 5;
    factors.push('Major export hub');
  }

  return {
    score: Math.min(score, 100),
    factors,
    tier: score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D',
  };
}

// ══════════════════════════════════════════════
// BATCH CLASSIFICATION
// ══════════════════════════════════════════════

/**
 * Classify a batch of suppliers with all intelligence layers
 */
export function classifySupplierBatch(suppliers) {
  const stats = {
    total: suppliers.length,
    manufacturers: 0, traders: 0, artisans: 0, unknown: 0,
    tierA: 0, tierB: 0, tierC: 0, tierD: 0,
  };

  const classified = suppliers.map((supplier) => {
    const typeResult = classifySupplierType(supplier);
    const categories = classifyProductCategories(supplier.product_categories || supplier.main_products);
    const exportCap = scoreExportCapability(supplier);

    stats[typeResult.type === 'manufacturer' ? 'manufacturers'
      : typeResult.type === 'trader' ? 'traders'
      : typeResult.type === 'artisan' ? 'artisans'
      : 'unknown']++;

    stats[`tier${exportCap.tier}`]++;

    return {
      ...supplier,
      // Classification results
      supplier_type: typeResult.type,
      supplier_type_confidence: typeResult.confidence,
      supplier_type_signals: typeResult.signals,
      // Product categories
      classified_categories: categories.map((c) => c.category),
      // Export capability
      export_capability_score: exportCap.score,
      export_capability_tier: exportCap.tier,
      export_capability_factors: exportCap.factors,
    };
  });

  log.info('Supplier classification complete', stats);
  return { suppliers: classified, stats };
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function parseEmployeeCount(val) {
  if (!val) return null;
  const str = String(val).toLowerCase();

  // "51-100" → 75
  const rangeMatch = str.match(/(\d+)\s*[-–to]+\s*(\d+)/);
  if (rangeMatch) return Math.round((parseInt(rangeMatch[1], 10) + parseInt(rangeMatch[2], 10)) / 2);

  // "100+" or "above 100" → 100
  const aboveMatch = str.match(/(?:above\s+)?(\d+)\s*\+?/);
  if (aboveMatch) return parseInt(aboveMatch[1], 10);

  return null;
}

export default {
  classifySupplierType, classifyProductCategories,
  scoreExportCapability, classifySupplierBatch,
};
