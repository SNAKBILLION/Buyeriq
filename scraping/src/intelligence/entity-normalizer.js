// ─────────────────────────────────────────────
// BuyerIQ — Entity Normalization Engine
// ─────────────────────────────────────────────
// Standardizes company names, country names,
// product names, and HS codes to canonical forms.
//
// "IKEA Inc" → "IKEA"
// "Wal-Mart Stores" → "Walmart"
// "UNITED STATES" → "United States" (code: USA)
// ─────────────────────────────────────────────
import { createLogger } from '../utils/logger.js';

const log = createLogger('normalizer');

// ══════════════════════════════════════════════
// COMPANY NAME NORMALIZATION
// ══════════════════════════════════════════════

/**
 * Known company aliases → canonical name
 * This is the core mapping for BuyerIQ's 31 buyers + common variations
 */
const COMPANY_ALIASES = {
  // ── Mega Retailers ──────────────────────
  'ikea': 'IKEA',
  'ikea inc': 'IKEA',
  'ikea supply': 'IKEA',
  'ikea supply ag': 'IKEA',
  'ikea of sweden': 'IKEA',
  'inter ikea': 'IKEA',
  'ingka group': 'IKEA',

  'walmart': 'Walmart',
  'wal mart': 'Walmart',
  'wal-mart': 'Walmart',
  'wal-mart stores': 'Walmart',
  'walmart inc': 'Walmart',
  'walmart stores': 'Walmart',

  'target': 'Target',
  'target corporation': 'Target',
  'target corp': 'Target',
  'target stores': 'Target',
  'target general merchandise': 'Target',

  'amazon': 'Amazon',
  'amazon com': 'Amazon',
  'amazon inc': 'Amazon',
  'amazon retail': 'Amazon',

  // ── Premium ────────────────────────────
  'crate and barrel': 'Crate & Barrel',
  'crate barrel': 'Crate & Barrel',
  'crate & barrel': 'Crate & Barrel',
  'euromarket designs': 'Crate & Barrel',

  'williams sonoma': 'Williams-Sonoma',
  'williams-sonoma': 'Williams-Sonoma',
  'williams sonoma inc': 'Williams-Sonoma',
  'ws home': 'Williams-Sonoma',

  'pottery barn': 'Pottery Barn',
  'potterybarn': 'Pottery Barn',

  'west elm': 'West Elm',
  'westelm': 'West Elm',

  'restoration hardware': 'RH',
  'rh': 'RH',

  'cb2': 'CB2',

  // ── European ───────────────────────────
  'maisons du monde': 'Maisons du Monde',
  'zara home': 'Zara Home',
  'h and m home': 'H&M Home',
  'h&m home': 'H&M Home',
  'hm home': 'H&M Home',

  'sostrene grene': 'Søstrene Grene',
  'sostrene grene': 'Søstrene Grene',
  'flying tiger': 'Flying Tiger Copenhagen',
  'flying tiger copenhagen': 'Flying Tiger Copenhagen',

  // ── Home/Department ────────────────────
  'bed bath and beyond': 'Bed Bath & Beyond',
  'bed bath beyond': 'Bed Bath & Beyond',
  'bb&b': 'Bed Bath & Beyond',
  'bbby': 'Bed Bath & Beyond',

  'wayfair': 'Wayfair',
  'wayfair inc': 'Wayfair',
  'wayfair llc': 'Wayfair',

  'pier 1': 'Pier 1 Imports',
  'pier 1 imports': 'Pier 1 Imports',
  'pier one': 'Pier 1 Imports',

  'tj maxx': 'TJX Companies',
  'tjx': 'TJX Companies',
  'tjx companies': 'TJX Companies',
  'homegoods': 'TJX Companies',
  'marshalls': 'TJX Companies',

  'costco': 'Costco',
  'costco wholesale': 'Costco',

  // ── Australian ─────────────────────────
  'temple and webster': 'Temple & Webster',
  'temple & webster': 'Temple & Webster',
  'kmart australia': 'Kmart Australia',
};

// Build lookup from normalized keys
const ALIAS_LOOKUP = new Map();
for (const [alias, canonical] of Object.entries(COMPANY_ALIASES)) {
  ALIAS_LOOKUP.set(alias.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(), canonical);
}

const COMPANY_SUFFIXES_PATTERN = /\b(inc|incorporated|corp|corporation|llc|ltd|limited|pvt|private|co|company|gmbh|ag|sa|srl|bv|nv|plc|pty|ab|oy|as|sas|sarl|kg|holdings|group|enterprises|industries|international|intl)\b\.?/gi;

/**
 * Normalize a company name to its canonical form
 * @param {string} name - Raw company name
 * @returns {{ canonical: string, wasNormalized: boolean, aliasMatched: boolean }}
 */
export function normalizeCompanyName(name) {
  if (!name) return { canonical: null, wasNormalized: false, aliasMatched: false };

  const cleaned = name
    .replace(/[""''`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Step 1: Check alias lookup
  const normalized = cleaned.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const aliasMatch = ALIAS_LOOKUP.get(normalized);
  if (aliasMatch) {
    return { canonical: aliasMatch, wasNormalized: true, aliasMatched: true };
  }

  // Step 2: Try without suffixes
  const withoutSuffix = normalized.replace(COMPANY_SUFFIXES_PATTERN, '').replace(/\s+/g, ' ').trim();
  const suffixMatch = ALIAS_LOOKUP.get(withoutSuffix);
  if (suffixMatch) {
    return { canonical: suffixMatch, wasNormalized: true, aliasMatched: true };
  }

  // Step 3: Title case cleanup
  const titleCased = cleaned
    .replace(COMPANY_SUFFIXES_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return { canonical: titleCased, wasNormalized: titleCased !== cleaned, aliasMatched: false };
}

// ══════════════════════════════════════════════
// COUNTRY NORMALIZATION
// ══════════════════════════════════════════════

const COUNTRY_MAP = {
  // Full names → standard
  'united states': { name: 'United States', code: 'USA', iso2: 'US' },
  'united states of america': { name: 'United States', code: 'USA', iso2: 'US' },
  'us': { name: 'United States', code: 'USA', iso2: 'US' },
  'usa': { name: 'United States', code: 'USA', iso2: 'US' },
  'u.s.a.': { name: 'United States', code: 'USA', iso2: 'US' },
  'u.s.': { name: 'United States', code: 'USA', iso2: 'US' },
  'america': { name: 'United States', code: 'USA', iso2: 'US' },

  'united kingdom': { name: 'United Kingdom', code: 'GBR', iso2: 'GB' },
  'uk': { name: 'United Kingdom', code: 'GBR', iso2: 'GB' },
  'great britain': { name: 'United Kingdom', code: 'GBR', iso2: 'GB' },
  'england': { name: 'United Kingdom', code: 'GBR', iso2: 'GB' },
  'britain': { name: 'United Kingdom', code: 'GBR', iso2: 'GB' },

  'germany': { name: 'Germany', code: 'DEU', iso2: 'DE' },
  'deutschland': { name: 'Germany', code: 'DEU', iso2: 'DE' },

  'france': { name: 'France', code: 'FRA', iso2: 'FR' },
  'netherlands': { name: 'Netherlands', code: 'NLD', iso2: 'NL' },
  'holland': { name: 'Netherlands', code: 'NLD', iso2: 'NL' },
  'the netherlands': { name: 'Netherlands', code: 'NLD', iso2: 'NL' },

  'australia': { name: 'Australia', code: 'AUS', iso2: 'AU' },
  'canada': { name: 'Canada', code: 'CAN', iso2: 'CA' },
  'japan': { name: 'Japan', code: 'JPN', iso2: 'JP' },

  'india': { name: 'India', code: 'IND', iso2: 'IN' },
  'china': { name: 'China', code: 'CHN', iso2: 'CN' },
  'peoples republic of china': { name: 'China', code: 'CHN', iso2: 'CN' },
  'prc': { name: 'China', code: 'CHN', iso2: 'CN' },
  'cn': { name: 'China', code: 'CHN', iso2: 'CN' },

  'vietnam': { name: 'Vietnam', code: 'VNM', iso2: 'VN' },
  'viet nam': { name: 'Vietnam', code: 'VNM', iso2: 'VN' },
  'indonesia': { name: 'Indonesia', code: 'IDN', iso2: 'ID' },
  'thailand': { name: 'Thailand', code: 'THA', iso2: 'TH' },

  'uae': { name: 'United Arab Emirates', code: 'ARE', iso2: 'AE' },
  'united arab emirates': { name: 'United Arab Emirates', code: 'ARE', iso2: 'AE' },
  'saudi arabia': { name: 'Saudi Arabia', code: 'SAU', iso2: 'SA' },
  'ksa': { name: 'Saudi Arabia', code: 'SAU', iso2: 'SA' },

  'singapore': { name: 'Singapore', code: 'SGP', iso2: 'SG' },
  'new zealand': { name: 'New Zealand', code: 'NZL', iso2: 'NZ' },
  'sweden': { name: 'Sweden', code: 'SWE', iso2: 'SE' },
  'poland': { name: 'Poland', code: 'POL', iso2: 'PL' },
  'romania': { name: 'Romania', code: 'ROU', iso2: 'RO' },

  'italy': { name: 'Italy', code: 'ITA', iso2: 'IT' },
  'spain': { name: 'Spain', code: 'ESP', iso2: 'ES' },
  'brazil': { name: 'Brazil', code: 'BRA', iso2: 'BR' },
  'mexico': { name: 'Mexico', code: 'MEX', iso2: 'MX' },
  'south korea': { name: 'South Korea', code: 'KOR', iso2: 'KR' },
  'korea': { name: 'South Korea', code: 'KOR', iso2: 'KR' },
  'taiwan': { name: 'Taiwan', code: 'TWN', iso2: 'TW' },
  'denmark': { name: 'Denmark', code: 'DNK', iso2: 'DK' },
  'norway': { name: 'Norway', code: 'NOR', iso2: 'NO' },
  'finland': { name: 'Finland', code: 'FIN', iso2: 'FI' },
  'belgium': { name: 'Belgium', code: 'BEL', iso2: 'BE' },
  'switzerland': { name: 'Switzerland', code: 'CHE', iso2: 'CH' },
  'austria': { name: 'Austria', code: 'AUT', iso2: 'AT' },
  'portugal': { name: 'Portugal', code: 'PRT', iso2: 'PT' },
  'turkey': { name: 'Turkey', code: 'TUR', iso2: 'TR' },
  'russia': { name: 'Russia', code: 'RUS', iso2: 'RU' },
  'malaysia': { name: 'Malaysia', code: 'MYS', iso2: 'MY' },
  'philippines': { name: 'Philippines', code: 'PHL', iso2: 'PH' },
};

/**
 * Normalize a country name/code to standard form
 * @param {string} input - Country name, code, or abbreviation
 * @returns {{ name: string, code: string, iso2: string } | null}
 */
export function normalizeCountry(input) {
  if (!input) return null;
  const key = input.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  return COUNTRY_MAP[key] || null;
}

// ══════════════════════════════════════════════
// PRODUCT NAME NORMALIZATION
// ══════════════════════════════════════════════

const PRODUCT_NOISE_WORDS = [
  'set of', 'pack of', 'piece', 'pcs', 'pcs.', 'with', 'and', 'for',
  'premium', 'organic', 'natural', 'handmade', 'handcrafted', 'artisan',
  'eco-friendly', 'eco friendly', 'sustainable', 'rustic', 'farmhouse',
  'modern', 'vintage', 'boho', 'large', 'small', 'medium', 'mini',
  'extra large', 'xl', 'xxl', 'new', 'best', 'top', 'quality',
  'free shipping', 'sale', 'clearance', 'hot',
];

const NOISE_PATTERN = new RegExp(`\\b(${PRODUCT_NOISE_WORDS.join('|')})\\b`, 'gi');

/**
 * Normalize a product name for matching
 * Strips noise words, sizes, and marketing fluff
 */
export function normalizeProductName(name) {
  if (!name) return null;
  return name
    .replace(/【.*?】/g, '')           // Remove bracketed content
    .replace(/\(.*?\)/g, '')           // Remove parenthetical
    .replace(/\d+\s*x\s*\d+/gi, '')   // Remove dimensions (12x8)
    .replace(/\d+\s*(inch|in|cm|mm)/gi, '') // Remove measurements
    .replace(NOISE_PATTERN, '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

// ══════════════════════════════════════════════
// HS CODE NORMALIZATION
// ══════════════════════════════════════════════

/**
 * Normalize HS code to standard format
 * "4419.00" → "441900"
 * "44 19" → "4419"
 * "HS 4419" → "4419"
 */
export function normalizeHSCode(code) {
  if (!code) return null;
  const cleaned = String(code)
    .replace(/^(HS|hscode|hs code|tariff)\s*:?\s*/i, '')
    .replace(/[^0-9]/g, '')
    .substring(0, 10);
  return cleaned || null;
}

/**
 * Get HS code parent (4-digit heading from 6-digit subheading)
 * "441900" → "4419"
 */
export function getHSHeading(code) {
  const norm = normalizeHSCode(code);
  return norm ? norm.substring(0, 4) : null;
}

// ══════════════════════════════════════════════
// BATCH NORMALIZATION
// ══════════════════════════════════════════════

/**
 * Normalize all entity fields in a batch of records
 */
export function normalizeEntityBatch(records, entityType) {
  const stats = { total: 0, companiesNormalized: 0, countriesNormalized: 0, aliasMatched: 0 };

  const normalized = records.map((r) => {
    stats.total++;
    const result = { ...r };

    // Normalize company name
    if (r.company_name || r.importer_name || r.exporter_name || r.supplier_name) {
      const nameField = r.company_name || r.importer_name || r.exporter_name || r.supplier_name;
      const { canonical, wasNormalized, aliasMatched } = normalizeCompanyName(nameField);
      if (r.company_name) result.company_name = canonical;
      if (r.importer_name) result.importer_name = normalizeCompanyName(r.importer_name).canonical;
      if (r.exporter_name) result.exporter_name = normalizeCompanyName(r.exporter_name).canonical;
      if (r.supplier_name) result.supplier_name = normalizeCompanyName(r.supplier_name).canonical;
      if (wasNormalized) stats.companiesNormalized++;
      if (aliasMatched) stats.aliasMatched++;
    }

    // Normalize country
    if (r.country) {
      const norm = normalizeCountry(r.country);
      if (norm) {
        result.country = norm.name;
        result.country_code = norm.code;
        stats.countriesNormalized++;
      }
    }

    // Normalize HS code
    if (r.hs_code) {
      result.hs_code = normalizeHSCode(r.hs_code);
    }

    // Normalize product name
    if (r.product_name) {
      result.product_name_normalized = normalizeProductName(r.product_name);
    }

    return result;
  });

  log.info(`Normalized ${stats.total} ${entityType} records`, stats);
  return { records: normalized, stats };
}

export default {
  normalizeCompanyName, normalizeCountry, normalizeProductName,
  normalizeHSCode, getHSHeading, normalizeEntityBatch,
  COMPANY_ALIASES, COUNTRY_MAP,
};
