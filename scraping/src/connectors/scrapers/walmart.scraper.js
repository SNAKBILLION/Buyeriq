// ─────────────────────────────────────────────
// BuyerIQ — Walmart Scraper (JSON + Web Unlocker)
// Verified: 2026-03-28
// ─────────────────────────────────────────────
import { BaseScraper } from './base.scraper.js';
import axios from 'axios';
import { load } from 'cheerio';

function detectMaterial(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('bamboo') && (t.includes('wood') || t.includes('acacia'))) return 'combo_wood_bamboo';
  if (t.includes('bamboo')) return 'bamboo';
  if (t.includes('acacia')) return 'acacia';
  if (t.includes('teak')) return 'teak';
  if (t.includes('walnut')) return 'walnut';
  if (t.includes('mango')) return 'mango';
  if (t.includes('olive')) return 'olive';
  if (t.includes('wood') || t.includes('wooden')) return 'wood';
  return null;
}

function extractSize(title) {
  const match = (title || '').match(/(\d+\.?\d*)\s*["']?\s*[xX×]\s*(\d+\.?\d*)\s*["']?/);
  if (match) return `${match[1]}x${match[2]} inch`;
  const setMatch = (title || '').match(/set of (\d+)|(\d+)[- ]?pack|(\d+)[- ]?piece/i);
  if (setMatch) return `Set of ${setMatch[1] || setMatch[2] || setMatch[3]}`;
  const sizeMatch = (title || '').match(/\b(extra large|large|medium|small|xl)\b/i);
  if (sizeMatch) return sizeMatch[1];
  return null;
}

class WalmartScraper extends BaseScraper {
  constructor() {
    super('walmart', { rateLimitSource: 'WALMART' });
    this.baseUrl = 'https://www.walmart.com';
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
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(keyword)}&page=${pageNum}`;
      this.log.info(`Walmart: Searching "${keyword}" page ${pageNum}`);
      try {
        const html = await this._fetchHTML(url);
        if (!html || String(html).length < 1000) continue;
        const $ = load(html);
        const products = [];
        const scriptText = $('script[type="application/json"]').first().html() || '';
        if (scriptText) {
          try {
            const json = JSON.parse(scriptText);
            const items = json?.props?.pageProps?.initialData?.searchResult?.itemStacks?.[0]?.items || [];
            items.forEach(item => {
              if (!item?.name) return;
              // VERIFIED: linePrice has actual price e.g. "$23.99"
              const priceStr = item.priceInfo?.linePrice || item.priceInfo?.itemPrice || null;
              const price = priceStr ? parseFloat(priceStr.replace(/[^0-9.]/g, '')) : null;

              // Skip if no valid price
              if (!price || price <= 0) return;

              const title = item.name;
              const material = detectMaterial(title);
              const size = extractSize(title);
              const productUrl = item.canonicalUrl ? `${this.baseUrl}${item.canonicalUrl}` : null;
              products.push({
                title,
                price,
                currency: 'USD',
                rating: item.averageRating || null,
                review_count: item.numberOfReviews || null,
                seller: item.sellerName || null,
                brand: item.brand || item.sellerName || null,
                url: productUrl,
                image_url: item.imageInfo?.thumbnailUrl || null,
                material,
                size,
                platform: 'walmart',
                _source: 'walmart',
                _keyword: keyword,
                _page: pageNum,
              });
            });
          } catch (parseErr) {
            this.log.warn(`Walmart JSON parse failed: ${parseErr.message}`);
          }
        }
        allProducts.push(...products);
        this.log.info(`Walmart page ${pageNum}: ${products.length} products`, { keyword });
      } catch (err) {
        this.log.error(`Walmart page ${pageNum} failed: ${err.message}`);
      }
    }
    return allProducts;
  }
}

export const walmartScraper = new WalmartScraper();
export default walmartScraper;
