// ─────────────────────────────────────────────
// BuyerIQ — Global Constants v2.1
// Wood-focused Marketplace Keywords
// ─────────────────────────────────────────────

// ── HS Codes tracked ─────────────────────────
export const HS_CODES = {
  // Wood
  WOOD_KITCHENWARE: '4419',
  WOOD_ORNAMENTAL: '4420',
  '441900': 'Tableware and kitchenware, of wood',
  '441910': 'Bread boards, chopping boards and similar',
  '441990': 'Other wood kitchenware',
  '442010': 'Statuettes and other ornaments, of wood',
  '442090': 'Other ornamental articles of wood',

  // Steel / Iron
  STEEL_KITCHENWARE: '7323',
  '732310': 'Iron/steel wool, pot scourers',
  '732391': 'Cast iron table/kitchen articles',
  '732393': 'Stainless steel table/kitchen articles',
  '732394': 'Iron/steel table/kitchen articles (other)',

  // Aluminum
  ALUMINUM_KITCHENWARE: '7615',
  '761510': 'Aluminum table/kitchen articles',
  '761590': 'Other aluminum household articles',

  // Glass
  GLASS_KITCHENWARE: '7013',
  '701310': 'Glass ceramics table/kitchen',
  '701342': 'Drinking glasses of lead crystal',
  '701349': 'Other drinking glasses',
  '701391': 'Lead crystal glassware',
  '701399': 'Other glassware',

  // Ceramic / Porcelain
  CERAMIC_KITCHENWARE: '6911',
  '691110': 'Porcelain/china tableware',
  '691190': 'Other porcelain articles',
  CERAMIC_OTHER: '6912',
  '691200': 'Ceramic tableware (non-porcelain)',

  // Plastic
  PLASTIC_KITCHENWARE: '3924',
  '392410': 'Plastic tableware',
  '392490': 'Other plastic household articles',

  // Bamboo / Rattan
  BAMBOO_KITCHENWARE: '4602',
  '460210': 'Basketwork of vegetable materials',
};

// Priority HS codes — COMTRADE mein yahi fetch honge
export const TARGET_HS_CODES = [
  // ── WOOD KITCHENWARE ──
  '441900', '441910', '441990',  // cutting boards, serving boards, spoons
  '442010', '442090',            // decorative wood items
  // ── STEEL / IRON (wood+iron combos) ──
  '732391',                      // cast iron cookware
  '732393',                      // stainless steel bowls, pans
  '732394',                      // iron kitchen accessories
  // ── GLASS (wood+glass combos) ──
  '701310',                      // glass ceramic bakeware
  '701349', '701399',            // drinking glasses, serving bowls
  // ── CERAMIC (wood+ceramic combos) ──
  '691110', '691190',            // porcelain dinner sets, mugs
  '691200',                      // stoneware, earthenware
  // ── ALUMINUM (wood+aluminum combos) ──
  '761510', '761590',            // aluminum pans, trays
  // ── BAMBOO ──
  '460210',                      // bamboo boards, serving items
  // ── COMBO ITEMS ──
  '821510',                      // wood-handle spoons, ladles
  '741810',                      // copper tableware
  '420500', '420590',            // leather handle articles
];

// 4-digit parent codes (for broader/fallback queries)
export const TARGET_HS_CODES_4DIGIT = [
  '4419', '4420',  // wood
  '7323',          // steel
  '7013',          // glass
  '6911', '6912',  // ceramic
  '7615',          // aluminum
  '4602',          // bamboo
  '8215',          // cutlery combo
  '7418',          // copper
  '4205',          // leather handle articles
];

// Material category mapping — 6 digit to material
export const HS_MATERIAL_MAP = {
  // Wood
  '441900': 'wood', '441910': 'wood', '441990': 'wood',
  '442010': 'wood', '442090': 'wood',
  // Steel
  '732310': 'steel', '732391': 'steel', '732393': 'steel', '732394': 'steel',
  // Glass
  '701310': 'glass', '701342': 'glass', '701349': 'glass',
  '701391': 'glass', '701399': 'glass',
  // Ceramic
  '691110': 'ceramic', '691190': 'ceramic', '691200': 'ceramic',
  // Aluminum
  '761510': 'aluminum', '761590': 'aluminum',
  // Plastic
  '392410': 'plastic', '392490': 'plastic',
  // Bamboo
  '460210': 'bamboo', '460290': 'bamboo',
  // Combo/Mixed
  '830241': 'combo_wood_metal', '821510': 'combo_wood_metal',
  '821520': 'combo_wood_metal', '821591': 'combo_wood_metal',
  '821300': 'combo_metal', '821410': 'combo_wood_metal',
  '741810': 'copper', '741820': 'copper',
  '450390': 'cork', '392690': 'silicone',
};

// Material categories — AI engine ke liye
export const MATERIAL_CATEGORIES = {
  wood: ['4419', '4420', '441900', '441910', '441990'],
  steel: ['7323', '732393', '732394'],
  glass: ['7013', '701349', '701399'],
  ceramic: ['6911', '6912'],
  aluminum: ['7615', '761510'],
  plastic: ['3924', '392410'],
  bamboo: ['4602'],
};

// ── Countries of interest ────────────────────
export const PRIORITY_MARKETS = [
  { code: 'USA', name: 'United States', priority: 1 },
  { code: 'GBR', name: 'United Kingdom', priority: 2 },
  { code: 'DEU', name: 'Germany', priority: 2 },
  { code: 'NLD', name: 'Netherlands', priority: 3 },
  { code: 'AUS', name: 'Australia', priority: 3 },
  { code: 'CAN', name: 'Canada', priority: 3 },
  { code: 'FRA', name: 'France', priority: 4 },
  { code: 'JPN', name: 'Japan', priority: 4 },
  { code: 'ARE', name: 'UAE', priority: 4 },
  { code: 'SAU', name: 'Saudi Arabia', priority: 5 },
  { code: 'SGP', name: 'Singapore', priority: 5 },
  { code: 'NZL', name: 'New Zealand', priority: 5 },
  { code: 'SWE', name: 'Sweden', priority: 5 },
];

export const COMPETITOR_ORIGINS = [
  { code: 'CHN', name: 'China' },
  { code: 'VNM', name: 'Vietnam' },
  { code: 'IDN', name: 'Indonesia' },
  { code: 'THA', name: 'Thailand' },
  { code: 'POL', name: 'Poland' },
  { code: 'ROU', name: 'Romania' },
  { code: 'TUR', name: 'Turkey' },
  { code: 'MEX', name: 'Mexico' },
];

export const INDIA_CODE = 'IND';

// ── Queue Names ──────────────────────────────
export const QUEUES = {
  TRADE_DATA: 'trade_data_ingestion_queue',
  SHIPMENT: 'shipment_scraper_queue',
  MARKETPLACE: 'marketplace_scraper_queue',
  SUPPLIER: 'supplier_scraper_queue',
  BUYER_DISCOVERY: 'buyer_discovery_queue',
  CURRENCY: 'currency_update_queue',
};

// ── Job Types ────────────────────────────────
export const JOB_TYPES = {
  COMTRADE_FETCH: 'comtrade_fetch',
  COMTRADE_BILATERAL: 'comtrade_bilateral',
  COMTRADE_FETCH_COMPETITORS: 'comtrade_fetch_competitors',
  USITC_FETCH: 'usitc_fetch',
  EUROSTAT_FETCH: 'eurostat_fetch',
  CENSUS_FETCH: 'census_fetch',
  WITS_FETCH: 'wits_fetch',

  IMPORTYETI_SEARCH: 'importyeti_search',
  IMPORTYETI_COMPANY: 'importyeti_company',
  ZAUBA_SEARCH: 'zauba_search',
  VOLZA_SEARCH: 'volza_search',
  CUSTOMS_FETCH: 'customs_fetch',

  AMAZON_SEARCH: 'amazon_search',
  AMAZON_PRODUCT: 'amazon_product',
  AMAZON_UK_SEARCH: 'amazon_uk_search',
  AMAZON_DE_SEARCH: 'amazon_de_search',
  WALMART_SEARCH: 'walmart_search',
  WAYFAIR_SEARCH: 'wayfair_search',
  ETSY_SEARCH: 'etsy_search',

  ALIBABA_SEARCH: 'alibaba_search',
  GLOBALSOURCES_SEARCH: 'globalsources_search',
  INDIAMART_SEARCH: 'indiamart_search',
  MADE_IN_CHINA_SEARCH: 'made_in_china_search',

  BUYER_PROCUREMENT_SCAN: 'buyer_procurement_scan',
  BUYER_PROFILE_ENRICH: 'buyer_profile_enrich',

  CURRENCY_UPDATE: 'currency_update',
};

// ── Scraping Config ──────────────────────────
export const SCRAPER_CONFIG = {
  concurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '3', 10),
  minDelay: parseInt(process.env.SCRAPER_MIN_DELAY_MS || '2000', 10),
  maxDelay: parseInt(process.env.SCRAPER_MAX_DELAY_MS || '8000', 10),
  timeout: parseInt(process.env.SCRAPER_TIMEOUT_MS || '30000', 10),
  maxRetries: parseInt(process.env.SCRAPER_MAX_RETRIES || '3', 10),
};

// ── WOOD-FOCUSED Marketplace Keywords ────────
// v2.1: Removed steel, glass, ceramic, aluminum (brought junk products)
// Only wood + wood combo keywords for Senses Lifestyle focus
export const MARKETPLACE_KEYWORDS = [
  // ── Pure Wood (29) ──
  'wooden cutting board',
  'wood cutting board acacia',
  'wood serving board',
  'wooden serving tray',
  'acacia wood kitchenware',
  'mango wood bowl',
  'mango wood serving board',
  'wooden salad bowl large',
  'wood cheese board',
  'charcuterie board wood',
  'wooden spoon set cooking',
  'wooden spatula set',
  'wooden utensils kitchen set',
  'olive wood utensils',
  'teak wood serving tray',
  'teak wood cutting board',
  'wooden mortar pestle',
  'wooden rolling pin',
  'bamboo cutting board',
  'bamboo kitchen accessories',
  'walnut wood cutting board',
  'beech wood kitchen',
  'wooden knife block',
  'wooden lazy susan',
  'wooden coasters set',
  'wood trivet kitchen',
  'wooden pizza peel',
  'wooden bread board',
  'wood salt pepper mill',

  // ── Wood + Iron/Metal Combo (5) ──
  'wood and iron serving tray',
  'wood metal kitchen accessories',
  'wooden handle iron utensils',
  'wood and metal cheese board',
  'mango wood iron stand',

  // ── Wood + Marble/Stone Combo (6) ──
  'wood marble cheese board',
  'marble and wood cutting board',
  'wood and marble serving tray',
  'acacia wood marble board',
  'wood marble serving platter',
  'marble wood kitchen accessories',

  // ── Wood + Resin/Epoxy Combo (3) ──
  'epoxy resin wood cutting board',
  'resin wood serving board',
  'river board epoxy wood',

  // ── Wood + Ceramic Combo (6) ──
  'wood ceramic serving set',
  'wooden tray ceramic bowls',
  'wood and ceramic serving board',
  'wooden stand ceramic bowls set',
  'wood ceramic cheese board set',
  'ceramic wood kitchen accessories',

  // ── Wood + Glass Combo (4) ──
  'wood and glass serving tray',
  'wooden tray with glass dome',
  'wood glass cheese board',
  'wooden frame glass jar kitchen',

  // ── Wood + Aluminum Combo (3) ──
  'wood aluminum kitchen accessories',
  'wooden handle aluminum cookware',
  'wood aluminum serving tray',

  // ── Wood + Steel Combo (4) ──
  'wood and stainless steel utensils',
  'wooden handle steel cookware',
  'wood steel kitchen accessories',
  'stainless steel wood cutting board',

  // ── Wood + Leather Combo (4) ──
  'leather and wood serving tray',
  'wood leather handle cutting board',
  'leather strap wooden cheese board',
  'wood and leather kitchen accessories',

  // ── Multi-Material Combo (3) ──
  'mixed material kitchen accessories wood',
  'wood metal glass serving set',
  'wood iron glass kitchenware set',

  // ── Trending 2025-2026 (10) ──
  'end grain cutting board',
  'personalized engraved cutting board',
  'live edge wood serving board',
  'wood grazing board',
  'sheesham wood kitchenware',
  'mango wood picture frame',
  'acacia wood picture frame',
  'wood bone brass frame',
  'reclaimed wood serving board',
  'handcrafted wood kitchen accessories',

  // ── Japan specific (8) ──
  'wooden cutting board japan',
  'acacia wood kitchen japan',
  'wood serving tray japan',
  'bamboo kitchen accessories japan',
  '木製まな板',
  'アカシア キッチン',
  '木製キッチン用品',
  '木製サービングボード',

  // ── Christmas / Holiday (8) ──
  'christmas wooden serving board',
  'personalised christmas cheese board',
  'christmas charcuterie board gift set',
  'christmas wood cutting board gift',
  'wooden christmas advent calendar box',
  'christmas wooden kitchen gift set',
  'engraved christmas cutting board',
  'holiday wood serving tray',

  // ── Cake Stand (5) ──
  'wooden cake stand',
  'wood cake stand rustic',
  'tiered wood cake stand',
  'mango wood cake stand',
  'reclaimed wood cake stand',

  // ── Pet Bowl Stand / Dog Feeder (5) ──
  'elevated dog bowl stand wood iron',
  'wooden dog feeder stand',
  'mango wood pet feeder stand',
  'raised dog bowl wood metal',
  'wood iron pet feeding station',

  // ── Kitchen Caddy / Utensil Holder (4) ──
  'wood and iron kitchen caddy',
  'wooden utensil caddy holder',
  'wood metal kitchen organizer caddy',
  'iron wood countertop caddy',

  // ── Fruit Basket Wood+Iron (6) ──
  'wood and iron fruit basket',
  'mango wood fruit basket stand',
  'iron wire fruit basket wood handle',
  'tiered iron fruit basket wood',
  'wood metal fruit holder kitchen',
  'acacia wood fruit basket',
];

// ── Supplier Keywords — ALL CATEGORIES ───────
export const SUPPLIER_KEYWORDS = [
  // Wood
  'wooden kitchenware manufacturer India',
  'wood kitchen utensils supplier',
  'wooden cutting board factory',
  'acacia wood products exporter',
  'wood handicraft exporter Moradabad',

  // Steel
  'stainless steel kitchenware manufacturer India',
  'steel kitchen utensils exporter',
  'iron cookware manufacturer',

  // Glass
  'glass kitchenware manufacturer India',
  'glass tableware exporter',
  'borosilicate glassware supplier',

  // Ceramic
  'ceramic kitchenware manufacturer India',
  'porcelain tableware exporter India',
  'stoneware manufacturer',

  // Aluminum
  'aluminum kitchenware manufacturer India',
  'aluminum cookware exporter',

  // General
  'kitchenware manufacturer Moradabad',
  'kitchenware exporter India',
  'home decor manufacturer India',
];

// ── Rate Limits ───────────────────────────────
export const RATE_LIMITS = {
  COMTRADE: { requests: 90, windowMs: 86400000 },
  CENSUS: { requests: 500, windowMs: 86400000 },
  WITS: { requests: 100, windowMs: 86400000 },
  EUROSTAT: { requests: 60, windowMs: 3600000 },
  AMAZON: { requests: 30, windowMs: 3600000 },
  WALMART: { requests: 20, windowMs: 3600000 },
  AMAZON_UK: { requests: 30, windowMs: 3600000 },
  AMAZON_DE: { requests: 30, windowMs: 3600000 },
  INDIAMART: { requests: 20, windowMs: 3600000 },
  MADE_IN_CHINA: { requests: 20, windowMs: 3600000 },
  WAYFAIR: { requests: 15, windowMs: 3600000 },
  ALIBABA: { requests: 20, windowMs: 3600000 },
  IMPORTYETI: { requests: 50, windowMs: 3600000 },
  ZAUBA: { requests: 20, windowMs: 3600000 },
  VOLZA: { requests: 10, windowMs: 86400000 },
  FRANKFURTER: { requests: 100, windowMs: 3600000 },
  DEFAULT: { requests: 30, windowMs: 3600000 },
};

// ── Data Confidence Levels ───────────────────
export const CONFIDENCE = {
  VERIFIED: 'VERIFIED',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNVERIFIED: 'UNVERIFIED',
};

// ── COMTRADE Numeric Country Codes ───────────
export const COMTRADE_COUNTRY_CODES = {
  IND: 699,
  USA: 842,
  GBR: 826,
  DEU: 276,
  NLD: 528,
  AUS: 36,
  CAN: 124,
  FRA: 251,
  JPN: 392,
  ARE: 784,
  SAU: 682,
  SGP: 702,
  NZL: 554,
  SWE: 752,
  CHN: 156,
  VNM: 704,
  TUR: 792,
  MEX: 484,
};

export default {
  HS_CODES, TARGET_HS_CODES, MATERIAL_CATEGORIES,
  PRIORITY_MARKETS, COMPETITOR_ORIGINS,
  QUEUES, JOB_TYPES, SCRAPER_CONFIG,
  MARKETPLACE_KEYWORDS, SUPPLIER_KEYWORDS,
  RATE_LIMITS, CONFIDENCE, COMTRADE_COUNTRY_CODES,
};