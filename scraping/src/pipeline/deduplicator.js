// ─────────────────────────────────────────────
// BuyerIQ — Deduplication Engine
// ─────────────────────────────────────────────
// Detects duplicate companies, products, shipments,
// and buyers using fuzzy matching, normalized names,
// and domain-based matching.
// ─────────────────────────────────────────────
import { createLogger } from '../utils/logger.js';

const log = createLogger('deduplicator');

// ══════════════════════════════════════════════
// STRING SIMILARITY (Levenshtein + Jaro-Winkler)
// ══════════════════════════════════════════════

/**
 * Levenshtein distance between two strings
 */
export function levenshtein(a, b) {
  if (!a || !b) return Math.max((a || '').length, (b || '').length);
  const la = a.length, lb = b.length;
  const dp = Array.from({ length: la + 1 }, (_, i) => {
    const row = new Array(lb + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[la][lb];
}

/**
 * Normalized similarity score (0-1, 1 = identical)
 */
export function similarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

/**
 * Jaro-Winkler similarity (better for short strings like company names)
 */
export function jaroWinkler(s1, s2) {
  if (!s1 || !s2) return 0;
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1;

  const la = a.length, lb = b.length;
  const matchWindow = Math.max(Math.floor(Math.max(la, lb) / 2) - 1, 0);

  const aMatches = new Array(la).fill(false);
  const bMatches = new Array(lb).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, lb);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const jaro = (matches / la + matches / lb + (matches - transpositions / 2) / matches) / 3;

  // Winkler bonus for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, la, lb); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// ══════════════════════════════════════════════
// COMPANY NAME NORMALIZATION FOR MATCHING
// ══════════════════════════════════════════════

const COMPANY_SUFFIXES = [
  'inc', 'incorporated', 'corp', 'corporation', 'llc', 'ltd', 'limited',
  'pvt', 'private', 'co', 'company', 'gmbh', 'ag', 'sa', 'srl', 'bv',
  'nv', 'plc', 'pty', 'ab', 'oy', 'as', 'sas', 'sarl', 'kg',
  'holdings', 'group', 'enterprises', 'industries', 'international',
  'intl', 'trading', 'import', 'export', 'imports', 'exports',
  'supply', 'supplies', 'wholesale', 'retail', 'stores', 'store',
];

const SUFFIX_PATTERN = new RegExp(
  `\\b(${COMPANY_SUFFIXES.join('|')})\\b\\.?`, 'gi'
);

/**
 * Normalize a company name for dedup matching
 * "IKEA Inc." → "ikea"
 * "Wal-Mart Stores, LLC" → "walmart stores"
 */
export function normalizeForMatch(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[""''`]/g, '')           // Remove quotes
    .replace(/[&]/g, 'and')            // & → and
    .replace(SUFFIX_PATTERN, '')       // Remove corporate suffixes
    .replace(/[^a-z0-9\s]/g, ' ')     // Remove special chars
    .replace(/\s+/g, ' ')             // Collapse whitespace
    .trim();
}

/**
 * Extract domain from URL for domain-based matching
 * "https://www.ikea.com/us/en/" → "ikea.com"
 */
export function extractDomain(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Extract core brand from domain
 * "ikea.com" → "ikea"
 * "williams-sonoma.com" → "williams sonoma"
 */
export function extractBrandFromDomain(domain) {
  if (!domain) return null;
  return domain
    .split('.')[0]
    .replace(/[-_]/g, ' ')
    .trim();
}

// ══════════════════════════════════════════════
// DEDUPLICATION STRATEGIES
// ══════════════════════════════════════════════

/**
 * Detect duplicate companies using multi-signal matching
 * Returns groups of duplicate records with confidence scores.
 *
 * @param {Array} records - Array of { company_name, country, website, ... }
 * @param {object} options - Thresholds
 * @returns {Array} Dedup groups: [{ canonical, duplicates, matchType, score }]
 */
export function deduplicateCompanies(records, options = {}) {
  const {
    nameThreshold = 0.85,    // Jaro-Winkler threshold for name match
    domainMatch = true,       // Also match by website domain
  } = options;

  const groups = [];
  const assigned = new Set();

  // Pre-compute normalized names and domains
  const enriched = records.map((r, idx) => ({
    ...r,
    _idx: idx,
    _normName: normalizeForMatch(r.company_name),
    _domain: extractDomain(r.website),
    _brand: extractBrandFromDomain(extractDomain(r.website)),
  }));

  for (let i = 0; i < enriched.length; i++) {
    if (assigned.has(i)) continue;

    const anchor = enriched[i];
    const group = {
      canonical: anchor,
      duplicates: [],
      matchType: 'unique',
      score: 1.0,
    };

    for (let j = i + 1; j < enriched.length; j++) {
      if (assigned.has(j)) continue;
      const candidate = enriched[j];

      // Strategy 1: Exact normalized name match
      if (anchor._normName && anchor._normName === candidate._normName) {
        group.duplicates.push({ ...candidate, _matchType: 'exact_name', _matchScore: 1.0 });
        assigned.add(j);
        continue;
      }

      // Strategy 2: Domain match
      if (domainMatch && anchor._domain && anchor._domain === candidate._domain) {
        group.duplicates.push({ ...candidate, _matchType: 'domain', _matchScore: 0.95 });
        assigned.add(j);
        continue;
      }

      // Strategy 3: Fuzzy name match (same country)
      if (anchor._normName && candidate._normName) {
        const nameSim = jaroWinkler(anchor._normName, candidate._normName);
        const sameCountry = anchor.country && candidate.country &&
          anchor.country.toLowerCase() === candidate.country.toLowerCase();

        if (nameSim >= nameThreshold && sameCountry) {
          group.duplicates.push({ ...candidate, _matchType: 'fuzzy_name', _matchScore: nameSim });
          assigned.add(j);
          continue;
        }

        // Strategy 4: Brand-from-domain matches name
        if (anchor._brand && candidate._normName) {
          const brandSim = jaroWinkler(anchor._brand, candidate._normName);
          if (brandSim >= 0.90) {
            group.duplicates.push({ ...candidate, _matchType: 'brand_domain', _matchScore: brandSim });
            assigned.add(j);
            continue;
          }
        }
      }
    }

    if (group.duplicates.length > 0) {
      group.matchType = 'merged';
      group.score = Math.max(...group.duplicates.map((d) => d._matchScore));
    }

    groups.push(group);
    assigned.add(i);
  }

  const totalDupes = groups.reduce((sum, g) => sum + g.duplicates.length, 0);
  if (totalDupes > 0) {
    log.info(`Dedup: ${records.length} records → ${groups.length} unique (${totalDupes} duplicates merged)`);
  }

  return groups;
}

/**
 * Deduplicate products by title similarity + platform
 */
export function deduplicateProducts(records, options = {}) {
  const { titleThreshold = 0.90 } = options;
  const groups = [];
  const assigned = new Set();

  const enriched = records.map((r, idx) => ({
    ...r,
    _idx: idx,
    _normTitle: (r.product_name || r.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim(),
  }));

  for (let i = 0; i < enriched.length; i++) {
    if (assigned.has(i)) continue;

    const anchor = enriched[i];
    const group = { canonical: anchor, duplicates: [] };

    for (let j = i + 1; j < enriched.length; j++) {
      if (assigned.has(j)) continue;
      const candidate = enriched[j];

      // Same platform + high title similarity = duplicate
      if (anchor.platform === candidate.platform) {
        const sim = similarity(anchor._normTitle, candidate._normTitle);
        if (sim >= titleThreshold) {
          group.duplicates.push({ ...candidate, _matchScore: sim });
          assigned.add(j);
        }
      }
    }

    groups.push(group);
    assigned.add(i);
  }

  return groups;
}

/**
 * Deduplicate shipment records
 * Match on: importer + exporter + date + HS code
 */
export function deduplicateShipments(records) {
  const seen = new Map();
  const unique = [];
  let dupes = 0;

  for (const r of records) {
    const key = [
      normalizeForMatch(r.importer_name),
      normalizeForMatch(r.exporter_name),
      r.shipment_date || '',
      r.hs_code || '',
    ].join('|');

    if (!seen.has(key)) {
      seen.set(key, r);
      unique.push(r);
    } else {
      dupes++;
      // Merge: keep the record with more data
      const existing = seen.get(key);
      const merged = mergeRecords(existing, r);
      seen.set(key, merged);
      const idx = unique.indexOf(existing);
      if (idx >= 0) unique[idx] = merged;
    }
  }

  if (dupes > 0) log.info(`Shipment dedup: ${records.length} → ${unique.length} (${dupes} merged)`);
  return unique;
}

/**
 * Merge two records, preferring non-null values
 */
function mergeRecords(a, b) {
  const merged = { ...a };
  for (const [key, val] of Object.entries(b)) {
    if (key.startsWith('_')) continue;
    if ((merged[key] === null || merged[key] === undefined) && val !== null && val !== undefined) {
      merged[key] = val;
    }
  }
  return merged;
}

// ══════════════════════════════════════════════
// BATCH DEDUP FOR DB (query existing records)
// ══════════════════════════════════════════════

/**
 * Check new records against existing DB records for duplicates.
 * Returns { newRecords, existingMatches }
 *
 * @param {Array} incoming - New records to check
 * @param {Function} dbLookupFn - async (normalizedNames) => existingRecords
 * @param {object} options
 */
export async function deduplicateAgainstDB(incoming, dbLookupFn, options = {}) {
  const { nameThreshold = 0.85 } = options;

  // Get normalized names for lookup
  const normNames = incoming.map((r) => normalizeForMatch(r.company_name || r.product_name));
  const uniqueNorms = [...new Set(normNames.filter(Boolean))];

  // Fetch potential matches from DB
  const existing = await dbLookupFn(uniqueNorms);

  const newRecords = [];
  const matches = [];

  for (const record of incoming) {
    const normName = normalizeForMatch(record.company_name || record.product_name);
    let matched = false;

    for (const dbRecord of existing) {
      const dbNorm = normalizeForMatch(dbRecord.company_name || dbRecord.product_name);
      const sim = jaroWinkler(normName, dbNorm);

      if (sim >= nameThreshold) {
        matches.push({
          incoming: record,
          existing: dbRecord,
          similarity: sim,
        });
        matched = true;
        break;
      }
    }

    if (!matched) {
      newRecords.push(record);
    }
  }

  log.info(`DB dedup: ${incoming.length} incoming → ${newRecords.length} new, ${matches.length} matched existing`);
  return { newRecords, matches };
}

export default {
  levenshtein, similarity, jaroWinkler,
  normalizeForMatch, extractDomain, extractBrandFromDomain,
  deduplicateCompanies, deduplicateProducts, deduplicateShipments,
  deduplicateAgainstDB,
};
