#!/usr/bin/env node
// ─────────────────────────────────────────────
// BuyerIQ — Manual Batch Scraper
// ─────────────────────────────────────────────
// Run ALL keywords for all marketplaces at once.
// Usage: node scripts/run-batch-scrape.js
// Takes 1-2 hours, uses ~$0.80-1.00 Bright Data
// ─────────────────────────────────────────────
import 'dotenv/config';
import { createLogger } from '../src/utils/logger.js';
import { MARKETPLACE_KEYWORDS } from '../src/config/constants.js';
import { healthCheck as dbHealth } from '../src/config/database.js';

const log = createLogger('batch-scraper');

// ── Wood filter ──
const WOOD_TERMS = [
  'wood','wooden','holz','bois','acacia','akazie','mango','teak',
  'bamboo','bambus','olive','olivenholz','walnut','nussbaum','maple',
  'ahorn','sheesham','rosewood','palisander','oak','eiche','beech',
  'buche','cherry','kirsch','birch','pine','cedar','rubber wood',
  'hevea','sapele','paulownia',
];
const EXCLUDE_TERMS = [
  'measuring cup', 'mineral oil', 'silicone', 'glass bowl',
  'non-stick', 'conditioner', 'food grade oil', 'cutting board oil',
  'board cream', 'board conditioner', 'beeswax',
];

function isWoodProduct(title = '') {
  const t = title.toLowerCase();
  const hasWood = WOOD_TERMS.some(w => t.includes(w));
  const hasExcluded = EXCLUDE_TERMS.some(e => t.includes(e));
  return hasWood && !hasExcluded;
}

// ── Alibaba keywords ──
const ALIBABA_KEYWORDS = [
  'wooden cutting board manufacturer',
  'acacia wood kitchenware supplier',
  'mango wood bowl wholesale',
  'wooden serving tray factory',
  'wood cheese board manufacturer',
  'wooden utensils set wholesale',
  'bamboo cutting board factory',
  'wooden mortar pestle supplier',
  'teak wood serving board',
  'olive wood kitchen utensils',
  'wood and iron serving tray',
  'wooden spoon set manufacturer',
  'wood marble cheese board',
  'wooden lazy susan wholesale',
  'wooden knife block manufacturer',
  'wood glass kitchenware manufacturer',
  'wood aluminum cookware factory',
  'wood steel kitchen accessories supplier',
  'wood ceramic tableware manufacturer',
  'wood marble cheese board factory',
  'wood leather serving tray wholesale',
  'mixed material wood kitchenware factory',
];

// ── Delay helper ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  log.info('═══════════════════════════════════════');
  log.info('  BuyerIQ — Manual Batch Scrape');
  log.info(`  Keywords: ${MARKETPLACE_KEYWORDS.length} marketplace + ${ALIBABA_KEYWORDS.length} alibaba`);
  log.info('═══════════════════════════════════════');

  // DB check
  const db = await dbHealth();
  if (!db.ok) { log.error('DB not available'); process.exit(1); }
  log.info('✓ DB connected');

  // Load scrapers
  const { amazonScraper } = await import('../src/connectors/scrapers/amazon.scraper.js');
  const { amazonUKScraper } = await import('../src/connectors/scrapers/amazon-uk.scraper.js');
  const { amazonDEScraper } = await import('../src/connectors/scrapers/amazon-de.scraper.js');
  const { walmartScraper } = await import('../src/connectors/scrapers/walmart.scraper.js');
  const { amazonFRScraper } = await import('../src/connectors/scrapers/amazon-fr.scraper.js');
  const { amazonCAScraper } = await import('../src/connectors/scrapers/amazon-ca.scraper.js');
  const { amazonAUScraper } = await import('../src/connectors/scrapers/amazon-au.scraper.js');
  const { amazonJPScraper } = await import('../src/connectors/scrapers/amazon-jp.scraper.js');
  const { alibabaScraper } = await import('../src/connectors/scrapers/alibaba.scraper.js');
  const { cleanRetailProduct, cleanSupplierRecord } = await import('../src/pipeline/cleaner.js');
  const { insertRetailProducts, insertSuppliers } = await import('../src/pipeline/db-inserter.js');

  const stats = { total: 0, inserted: 0, skipped: 0, errors: 0 };

  // ══════════════════════════════════════════
  // RETAIL SCRAPERS (Amazon US/UK/DE + Walmart)
  // ══════════════════════════════════════════
  const scrapers = [
    { name: 'Amazon US', scraper: amazonScraper, platform: 'amazon' },
    { name: 'Amazon UK', scraper: amazonUKScraper, platform: 'amazon_uk' },
    { name: 'Amazon DE', scraper: amazonDEScraper, platform: 'amazon_de' },
    { name: 'Walmart', scraper: walmartScraper, platform: 'walmart' },
    { name: 'Amazon FR', scraper: amazonFRScraper, platform: 'amazon_fr' },
    { name: 'Amazon CA', scraper: amazonCAScraper, platform: 'amazon_ca' },
    { name: 'Amazon AU', scraper: amazonAUScraper, platform: 'amazon_au' },
    { name: 'Amazon JP', scraper: amazonJPScraper, platform: 'amazon_jp' },
  ];

  for (const { name, scraper, platform } of scrapers) {
    log.info(`\n── ${name} (${MARKETPLACE_KEYWORDS.length} keywords) ──`);

    for (let i = 0; i < MARKETPLACE_KEYWORDS.length; i++) {
      const keyword = MARKETPLACE_KEYWORDS[i];
      try {
        log.info(`[${i + 1}/${MARKETPLACE_KEYWORDS.length}] ${name}: "${keyword}"`);
        const raw = await scraper.searchProducts(keyword, 1);
        const woodOnly = raw.filter(p => isWoodProduct(p.title || p.product_title || ''));
        const cleaned = woodOnly.map(p => cleanRetailProduct({ ...p, platform, _source: platform }));
        const result = await insertRetailProducts(cleaned);

        stats.total += raw.length;
        stats.inserted += result.inserted;
        stats.skipped += (woodOnly.length - result.inserted);

        log.info(`  → ${raw.length} found, ${woodOnly.length} wood, ${result.inserted} inserted`);
      } catch (err) {
        stats.errors++;
        log.error(`  → ERROR: ${err.message}`);
      }

      // Delay between requests (5-10 sec)
      if (i < MARKETPLACE_KEYWORDS.length - 1) {
        await sleep(5000 + Math.random() * 5000);
      }
    }

    log.info(`✓ ${name} complete`);
    // Delay between scrapers (30 sec)
    await sleep(30000);
  }

  // ══════════════════════════════════════════
  // ALIBABA (Supplier data)
  // ══════════════════════════════════════════
  log.info(`\n── Alibaba (${ALIBABA_KEYWORDS.length} keywords) ──`);

  for (let i = 0; i < ALIBABA_KEYWORDS.length; i++) {
    const keyword = ALIBABA_KEYWORDS[i];
    try {
      log.info(`[${i + 1}/${ALIBABA_KEYWORDS.length}] Alibaba: "${keyword}"`);
      const raw = await alibabaScraper.searchSuppliers(keyword, 1);

      const mapped = raw.filter(p => p.title || p.supplier_name).map(p => ({
        company_name: p.supplier_name || p.title?.substring(0, 100) || 'Unknown',
        country: p.location || 'China',
        country_code: 'CHN',
        region: p.location || null,
        product_categories: [keyword.split(' ').slice(0, 2).join(' ')],
        source_platform: 'alibaba',
        source_url: p.product_url || null,
        confidence: p.is_verified ? 'verified' : 'industry_estimate',
        year_established: p.years_on_alibaba ? (new Date().getFullYear() - p.years_on_alibaba) : null,
        raw_data: {
          title: p.title,
          price_min: p.price_min,
          price_max: p.price_max,
          price_range: p.price_range,
          moq: p.moq,
          image_url: p.image_url,
          is_verified: p.is_verified,
          keyword,
        },
      }));

      const cleaned = mapped.map(s => {
        const c = cleanSupplierRecord(s);
        c.confidence = s.confidence || 'industry_estimate';
        return c;
      });

      const result = await insertSuppliers(cleaned);
      stats.inserted += result.inserted;
      log.info(`  → ${raw.length} found, ${result.inserted} suppliers inserted`);
    } catch (err) {
      stats.errors++;
      log.error(`  → ERROR: ${err.message}`);
    }

    if (i < ALIBABA_KEYWORDS.length - 1) {
      await sleep(5000 + Math.random() * 5000);
    }
  }

  // ══════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════
  log.info('\n═══════════════════════════════════════');
  log.info('  BATCH SCRAPE COMPLETE');
  log.info(`  Total found:  ${stats.total}`);
  log.info(`  Inserted:     ${stats.inserted}`);
  log.info(`  Skipped/Dup:  ${stats.skipped}`);
  log.info(`  Errors:       ${stats.errors}`);
  log.info('═══════════════════════════════════════');

  process.exit(0);
}

main().catch(err => {
  log.error('Batch scrape failed:', err.message);
  process.exit(1);
});
