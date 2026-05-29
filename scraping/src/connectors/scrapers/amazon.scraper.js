// ─────────────────────────────────────────────
// BuyerIQ — Amazon US Scraper (Cheerio + Web Unlocker)
// Verified selectors: 2026-03-28
// ─────────────────────────────────────────────
import { BaseScraper } from './base.scraper.js';
import axios from 'axios';
import { load } from 'cheerio';

// Extract material from title
function detectMaterial(title) {
  const t = title.toLowerCase();
  if (t.includes('bamboo') && (t.includes('wood') || t.includes('acacia') || t.includes('teak'))) return 'combo_wood_bamboo';
  if (t.includes('bamboo')) return 'bamboo';
  if (t.includes('acacia')) return 'acacia';
  if (t.includes('teak')) return 'teak';
  if (t.includes('walnut')) return 'walnut';
  if (t.includes('mango')) return 'mango';
  if (t.includes('olive')) return 'olive';
  if (t.includes('wood') || t.includes('wooden')) return 'wood';
  return null;
}

// Extract size from title
function extractSize(title) {
  const match = title.match(/(\d+\.?\d*)\s*["']?\s*[xX×]\s*(\d+\.?\d*)\s*["']?/);
  if (match) return `${match[1]}x${match[2]} inch`;
  const setMatch = title.match(/set of (\d+)|(\d+)[- ]?pack|(\d+)[- ]?piece/i);
  if (setMatch) return `Set of ${setMatch[1] || setMatch[2] || setMatch[3]}`;
  const sizeMatch = title.match(/\b(extra large|large|medium|small|xl|xxl)\b/i);
  if (sizeMatch) return sizeMatch[1];
  return null;
}

class AmazonScraper extends BaseScraper {
  constructor() {
    super('amazon', { rateLimitSource: 'AMAZON' });
    this.baseUrl = 'https://www.amazon.com';
  }

  async _fetchHTML(url) {
    const apiKey = process.env.BRIGHT_DATA_API_KEY;
    if (apiKey && process.env.PROXY_ROTATION_URL?.includes('web_unlocker')) {
      const response = await axios.post('https://api.brightdata.com/request', {
        zone: 'web_unlocker1', url, format: 'raw',
      }, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        timeout: 60000,
      });
      return typeof response.data === 'string' ? response.data : String(response.data);
    }
    return null;
  }

  async searchProducts(keyword, maxPages = 2) {
    const allProducts = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const url = `${this.baseUrl}/s?k=${encodeURIComponent(keyword)}&page=${pageNum}`;
      this.log.info(`Amazon US: Searching "${keyword}" page ${pageNum}`);

      try {
        const html = await this._fetchHTML(url);
        if (!html || String(html).length < 1000) continue;

        const $ = load(html);
        const products = [];

        $('[data-component-type="s-search-result"]').each((i, el) => {
          const asin = $(el).attr('data-asin');
          if (!asin) return;

          const title = $(el).find('h2 span').first().text().trim();
          if (!title) return;

          // Price
          const priceWhole = $(el).find('.a-price-whole').first().text().replace(/[^0-9]/g, '');
          const priceFrac = $(el).find('.a-price-fraction').first().text().replace(/[^0-9]/g, '') || '00';
          const price = priceWhole ? parseFloat(`${priceWhole}.${priceFrac}`) : null;

          // Skip if no valid price
          if (!price || price <= 0) return;

          // Rating
          const ratingText = $(el).find('.a-icon-alt').first().text();
          const rating = ratingText ? parseFloat(ratingText.match(/[\d.]+/)?.[0]) : null;

          // Reviews — VERIFIED: aria-label="3,208 ratings"
          const reviewLabel = $(el).find('[aria-label*="ratings"]').first().attr('aria-label') || '';
          const reviewCount = reviewLabel ? parseInt(reviewLabel.replace(/[^0-9]/g, ''), 10) || null : null;

          // Image
          const imageUrl = $(el).find('.s-image').attr('src') || null;

          // URL — build from ASIN (reliable)
          const productUrl = `${this.baseUrl}/dp/${asin}`;

          // Brand — from title or byline
          const byline = $(el).find('.a-size-base-plus').first().text().trim();
          const brand = byline && byline.length < 50 ? byline : null;

          // Prime badge
          const isPrime = $(el).find('[aria-label="Amazon Prime"]').length > 0;

          // Material + Size from title
          const material = detectMaterial(title);
          const size = extractSize(title);

          products.push({
            asin,
            title,
            price,
            currency: 'USD',
            rating,
            review_count: reviewCount,
            image_url: imageUrl,
            url: productUrl,
            brand,
            material,
            size,
            is_prime: isPrime,
            platform: 'amazon',
            _source: 'amazon',
            _keyword: keyword,
            _page: pageNum,
          });
        });

        allProducts.push(...products);
        this.log.info(`Amazon US page ${pageNum}: ${products.length} products`, { keyword });

      } catch (err) {
        this.log.error(`Amazon US page ${pageNum} failed: ${err.message}`);
      }
    }

    return allProducts;
  }
}

export const amazonScraper = new AmazonScraper();
export default amazonScraper;
