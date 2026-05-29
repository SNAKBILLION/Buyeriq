// ─────────────────────────────────────────────
// BuyerIQ — Data Cleaning Pipeline
// ─────────────────────────────────────────────
// Cleans, deduplicates, and validates raw data
// before insertion into PostgreSQL.
// ─────────────────────────────────────────────
import { createLogger } from '../utils/logger.js';
import { CONFIDENCE } from '../config/constants.js';

const log = createLogger('cleaner');

// ── Country Name → ISO3 Code ─────────────────
const COUNTRY_CODES = {
  'china': 'CHN', 'vietnam': 'VNM', 'india': 'IND', 'bangladesh': 'BGD',
  'indonesia': 'IDN', 'turkey': 'TUR', 'pakistan': 'PAK', 'taiwan': 'TWN',
  'thailand': 'THA', 'united states': 'USA', 'usa': 'USA', 'cambodia': 'KHM',
  'mexico': 'MEX', 'malaysia': 'MYS', 'philippines': 'PHL', 'sri lanka': 'LKA',
  'myanmar': 'MMR', 'ethiopia': 'ETH', 'germany': 'DEU', 'uk': 'GBR',
  'united kingdom': 'GBR', 'france': 'FRA', 'italy': 'ITA', 'spain': 'ESP',
  'portugal': 'PRT', 'netherlands': 'NLD', 'hong kong': 'HKG', 'south korea': 'KOR',
  'japan': 'JPN', 'australia': 'AUS', 'canada': 'CAN', 'brazil': 'BRA',
};

function toCountryCode(val) {
  if (!val) return null;
  const clean = String(val).trim().toLowerCase();
  // Already a 3-letter code
  if (/^[a-z]{3}$/i.test(clean)) return clean.toUpperCase();
  return COUNTRY_CODES[clean] || String(val).substring(0, 3).toUpperCase();
}


// ── Trade Data Cleaner ───────────────────────
export function cleanTradeRecord(raw) {
  return {
    reporter_code: sanitizeString(raw.reporterCode || raw.reporter_code),
    partner_code: sanitizeString(raw.partnerCode || raw.partner_code),
    hs_code: sanitizeHSCode(raw.cmdCode || raw.hs_code),
    trade_flow: normalizeTradeFlow(raw.flowDesc || raw.trade_flow),
    trade_value_usd: sanitizeNumber(raw.primaryValue || raw.trade_value_usd),
    net_weight_kg: sanitizeNumber(raw.netWgt || raw.net_weight_kg),
    quantity: sanitizeNumber(raw.qty || raw.quantity),
    year: parseInt(raw.period?.toString().substring(0, 4) || raw.year, 10),
    period: sanitizeString(raw.period || raw.time_period),
    source: raw._source || 'comtrade',
    confidence: raw._source === 'comtrade' ? CONFIDENCE.VERIFIED : CONFIDENCE.HIGH,
    raw_data: raw,
  };
}

// ── Shipment Record Cleaner ──────────────────
export function cleanShipmentRecord(raw) {
  return {
    importer_name: normalizeCompanyName(raw.importer || raw.importer_name),
    exporter_name: normalizeCompanyName(raw.exporter || raw.exporter_name),
    hs_code: sanitizeHSCode(raw.hs_code || raw.hsCode),
    product_description: sanitizeString(raw.product_description || raw.description, 500),
    origin_country: toCountryCode(raw.origin_country || raw.exporter_country || raw.origin),
    destination_country: toCountryCode(raw.destination_country || raw.dest_country || raw.destination),
    port_of_entry: sanitizeString(raw.port_of_entry || raw.port),
    shipment_date: sanitizeDate(raw.shipment_date || raw.date),
    weight_kg: sanitizeNumber(raw.weight_kg || raw.weight),
    value_usd: sanitizeNumber(raw.value_usd || raw.value),
    container_type: sanitizeString(raw.container_type),
    source: raw._source || 'importyeti',
    confidence: CONFIDENCE.MEDIUM,
    raw_data: raw,
  };
}

// ── Retail Product Cleaner ───────────────────
export function cleanRetailProduct(raw) {
  const title = sanitizeString(raw.title || raw.product_name, 300);
  return {
    platform: sanitizeString(raw.platform || raw._source),
    product_name: title,
    product_url: sanitizeUrl(raw.url || raw.product_url),
    price: sanitizePrice(raw.price),
    currency: sanitizeString(raw.currency || 'USD'),
    rating: sanitizeRating(raw.rating),
    review_count: sanitizeNumber(raw.review_count || raw.reviews),
    seller_name: sanitizeString(raw.seller || raw.seller_name, 200),
    brand: sanitizeString(raw.brand, 200),
    category: sanitizeString(raw.category, 200) || (() => {
      const t = title.toLowerCase();
      if (t.includes('cutting board') || t.includes('chopping board') || t.includes('butcher block') || t.includes('schneidebrett') || t.includes('hackblock') || t.includes('hirnholzbrett') || t.includes('planche') || t.includes('まな板')) return 'Cutting & Chopping Boards';
      if (t.includes('serving tray') || t.includes('serving platter') || t.includes('servierbrett') || t.includes('serviertablett') || t.includes('plateau de service') || t.includes('トレー')) return 'Serving Trays & Platters';
      if (t.includes('salad bowl') || t.includes('wood bowl') || t.includes('wooden bowl') || t.includes('saladier') || t.includes('salatsch') || t.includes('obstschale') || t.includes('schüssel') || t.includes('ボウル') || t.includes('サラダボウル')) return 'Wood Bowls';
      if (t.includes('spoon') || t.includes('spatula') || t.includes('utensil') || t.includes('ladle') || t.includes('cuill') || t.includes('ustensile') || t.includes('spatule') || t.includes('löffel') || t.includes('kochlöffel') || t.includes('spatel') || t.includes('スプーン') || t.includes('へら')) return 'Spoons & Utensils';
      if (t.includes('cheese board') || t.includes('charcuterie')) return 'Cheese & Charcuterie Boards';
      if (t.includes('mortar') || t.includes('pestle')) return 'Mortar & Pestle';
      if (t.includes('pizza peel') || t.includes('bread board')) return 'Pizza Peels & Bread Boards';
      if (t.includes('knife block') || t.includes('knife holder')) return 'Knife Blocks & Holders';
      const mat = raw.material || '';
      if (mat.includes('glass')) return 'Wood + Glass Combo';
      if (mat.includes('steel') || mat.includes('metal') || mat.includes('iron')) return 'Wood + Iron Combo';
      if (mat.includes('marble')) return 'Wood + Marble Combo';
      if (mat.includes('resin')) return 'Wood + Resin Combo';
      if (mat.includes('ceramic')) return 'Wood + Ceramic Combo';
      if (mat.includes('aluminum')) return 'Wood + Aluminum Combo';
      if (mat.includes('leather')) return 'Wood + Leather Combo';
      return 'General Wood Kitchenware';
    })(),
    material: detectMaterial(title, raw._keyword),
    asin: sanitizeString(raw.asin),
    image_url: sanitizeUrl(raw.image_url || raw.image),
    is_prime: raw.is_prime === true || raw.is_prime === 'true',
    bsr_rank: sanitizeNumber(raw.bsr_rank || raw.best_seller_rank),
    scraped_at: new Date().toISOString(),
    source: raw._source || raw.platform,
    confidence: CONFIDENCE.MEDIUM,
  };
}

/**
 * Detect material from product title + search keyword
 */
function detectMaterial(title, keyword) {
  const text = ((title || '') + ' ' + (keyword || '')).toLowerCase();
  const materialPatterns = [
    { material: 'wood', patterns: ['wood', 'acacia', 'mango', 'teak', 'sheesham', 'olive wood', 'walnut', 'oak', 'beech', 'rubberwood', 'timber'] },
    { material: 'bamboo', patterns: ['bamboo', 'rattan'] },
    { material: 'steel', patterns: ['stainless steel', 'steel', 'iron', 'cast iron'] },
    { material: 'glass', patterns: ['glass', 'borosilicate', 'pyrex'] },
    { material: 'ceramic', patterns: ['ceramic', 'porcelain', 'stoneware', 'earthenware'] },
    { material: 'aluminum', patterns: ['aluminum', 'aluminium', 'anodized'] },
    { material: 'copper', patterns: ['copper', 'brass'] },
    { material: 'silicone', patterns: ['silicone'] },
    { material: 'plastic', patterns: ['plastic', 'melamine'] },
    { material: 'cork', patterns: ['cork'] },
  ];

  const detected = [];
  for (const { material, patterns } of materialPatterns) {
    if (patterns.some(p => text.includes(p))) detected.push(material);
  }

  if (detected.length === 0) return null;
  if (detected.length === 1) return detected[0];
  // Combo material: "wood + iron", "glass + wood" etc
  return 'combo_' + detected.join('_');
}

// ── Supplier Cleaner ─────────────────────────
export function cleanSupplierRecord(raw) {
  return {
    company_name: normalizeCompanyName(raw.company_name || raw.name),
    country: sanitizeString(raw.country),
    region: sanitizeString(raw.region || raw.city),
    product_categories: sanitizeArray(raw.product_categories || raw.categories),
    certifications: sanitizeArray(raw.certifications || raw.certs),
    year_established: sanitizeNumber(raw.year_established || raw.established),
    employee_count: sanitizeString(raw.employee_count || raw.employees),
    annual_revenue: sanitizeString(raw.annual_revenue || raw.revenue),
    website: sanitizeUrl(raw.website),
    contact_email: sanitizeEmail(raw.email || raw.contact_email),
    source_platform: sanitizeString(raw.source_platform || raw._source),
    source_url: sanitizeUrl(raw.source_url || raw.url),
    confidence: CONFIDENCE.MEDIUM,
    raw_data: raw,
  };
}

// ── Company / Buyer Cleaner ──────────────────
export function cleanBuyerRecord(raw) {
  return {
    company_name: normalizeCompanyName(raw.company_name || raw.name),
    country: sanitizeString(raw.country),
    website: sanitizeUrl(raw.website),
    industry: sanitizeString(raw.industry),
    buyer_type: sanitizeString(raw.buyer_type || raw.type), // retailer, distributor, etc.
    estimated_revenue: sanitizeString(raw.revenue),
    product_categories: sanitizeArray(raw.product_categories),
    source: raw._source || 'discovery',
    confidence: CONFIDENCE.LOW,
    raw_data: raw,
  };
}

// ── Price Data Cleaner ───────────────────────
export function cleanPriceRecord(raw) {
  return {
    product_type: sanitizeString(raw.product_type || raw.category),
    price_usd: sanitizePrice(raw.price_usd || raw.price),
    price_type: sanitizeString(raw.price_type || 'retail'), // fob, retail, wholesale
    source_platform: sanitizeString(raw.source_platform || raw._source),
    source_url: sanitizeUrl(raw.source_url || raw.url),
    currency_original: sanitizeString(raw.currency || 'USD'),
    price_original: sanitizePrice(raw.price_original || raw.price),
    recorded_at: new Date().toISOString(),
    confidence: CONFIDENCE.MEDIUM,
  };
}

// ══════════════════════════════════════════════
// SANITIZATION HELPERS
// ══════════════════════════════════════════════

function sanitizeString(val, maxLen = 255) {
  if (val === null || val === undefined) return null;
  return String(val).trim().substring(0, maxLen) || null;
}

function sanitizeNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]/g, '')) : Number(val);
  return isNaN(num) ? null : num;
}

function sanitizePrice(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/[^0-9.,]/g, '').replace(',', '');
  const num = parseFloat(str);
  return isNaN(num) || num < 0 ? null : Math.round(num * 100) / 100;
}

function sanitizeRating(val) {
  const num = sanitizeNumber(val);
  if (num === null) return null;
  return Math.min(Math.max(num, 0), 5);
}

function sanitizeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function sanitizeUrl(val) {
  if (!val) return null;
  try {
    const url = new URL(String(val).trim());
    return url.toString();
  } catch {
    return null;
  }
}

function sanitizeEmail(val) {
  if (!val) return null;
  const email = String(val).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function sanitizeHSCode(val) {
  if (!val) return null;
  return String(val).replace(/[^0-9]/g, '').substring(0, 10) || null;
}

function sanitizeArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
  if (typeof val === 'string') return val.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

function normalizeCompanyName(name) {
  if (!name) return null;
  return String(name)
    .trim()
    .replace(/\s+/g, ' ')               // collapse whitespace
    .replace(/[""]/g, '"')              // normalize quotes
    .replace(/\b(LLC|LTD|INC|CORP|CO|PVT|PRIVATE|LIMITED)\b\.?/gi, (m) => m.toUpperCase().replace('.', ''))
    .substring(0, 300);
}

function normalizeTradeFlow(flow) {
  if (!flow) return null;
  const f = String(flow).toLowerCase().trim();
  if (f.includes('import') || f === 'm') return 'import';
  if (f.includes('export') || f === 'x') return 'export';
  if (f.includes('re-import')) return 're-import';
  if (f.includes('re-export')) return 're-export';
  return f;
}

// ── Deduplication ────────────────────────────

/**
 * Deduplicate records by a composite key function
 */
export function dedup(records, keyFn) {
  const seen = new Map();
  const unique = [];

  for (const record of records) {
    const key = keyFn(record);
    if (!seen.has(key)) {
      seen.set(key, true);
      unique.push(record);
    }
  }

  const dupes = records.length - unique.length;
  if (dupes > 0) {
    log.debug(`Dedup removed ${dupes} duplicates from ${records.length} records`);
  }

  return unique;
}

/**
 * Filter out records with too many null fields
 */
export function filterIncomplete(records, requiredFields, minRequired = null) {
  const min = minRequired || requiredFields.length;
  return records.filter((r) => {
    const present = requiredFields.filter((f) => r[f] !== null && r[f] !== undefined).length;
    return present >= min;
  });
}

export default {
  cleanTradeRecord, cleanShipmentRecord, cleanRetailProduct,
  cleanSupplierRecord, cleanBuyerRecord, cleanPriceRecord,
  dedup, filterIncomplete,
};
