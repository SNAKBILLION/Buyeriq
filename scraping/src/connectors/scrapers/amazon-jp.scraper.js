import { BaseScraper } from './base.scraper.js';
import axios from 'axios';
import { load } from 'cheerio';

function detectMaterial(title) {
  const t = title.toLowerCase();
  if (t.includes('bamboo') || t.includes('竹')) return 'bamboo';
  if (t.includes('acacia') || t.includes('アカシア')) return 'acacia';
  if (t.includes('teak') || t.includes('チーク')) return 'teak';
  if (t.includes('walnut') || t.includes('ウォールナット')) return 'walnut';
  if (t.includes('wood') || t.includes('wooden') || t.includes('木製') || t.includes('木')) return 'wood';
  return null;
}

function extractSize(title) {
  const match = title.match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)\s*(?:cm|mm)?/);
  if (match) return `${match[1]}x${match[2]}`;
  const setMatch = title.match(/(\d+)個セット|set of (\d+)|(\d+)[- ]?pack/i);
  if (setMatch) return `Set of ${setMatch[1] || setMatch[2] || setMatch[3]}`;
  return null;
}

class AmazonJPScraper extends BaseScraper {
  constructor() {
    super('amazon-jp', { rateLimitSource: 'AMAZON_JP' });
    this.baseUrl = 'https://www.amazon.co.jp';
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
      this.log.info(`Amazon JP: Searching "${keyword}" page ${pageNum}`);
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
          const priceWhole = $(el).find('.a-price-whole').first().text().replace(/[^0-9]/g, '');
          const price = priceWhole ? parseFloat(priceWhole) : null;
          if (!price || price <= 0) return;
          const ratingText = $(el).find('.a-icon-alt').first().text();
          const rating = ratingText ? parseFloat(ratingText.match(/[\d.]+/)?.[0]) : null;
          const reviewLabel = $(el).find('[aria-label*="個の評価"], [aria-label*="ratings"]').first().attr('aria-label') || '';
          const reviewCount = reviewLabel ? parseInt(reviewLabel.replace(/[^0-9]/g, ''), 10) || null : null;
          const imageUrl = $(el).find('.s-image').attr('src') || null;
          const productUrl = `${this.baseUrl}/dp/${asin}`;
          const byline = $(el).find('.a-size-base-plus').first().text().trim();
          const brand = byline && byline.length < 50 ? byline : null;
          const material = detectMaterial(title);
          const size = extractSize(title);
          products.push({
            asin, title, price, currency: 'JPY', rating,
            review_count: reviewCount, image_url: imageUrl,
            url: productUrl, brand, material, size,
            platform: 'amazon_jp', _source: 'amazon_jp',
            _keyword: keyword, _page: pageNum,
          });
        });
        allProducts.push(...products);
        this.log.info(`Amazon JP page ${pageNum}: ${products.length} products`, { keyword });
      } catch (err) {
        this.log.error(`Amazon JP page ${pageNum} failed: ${err.message}`);
      }
    }
    return allProducts;
  }
}

export const amazonJPScraper = new AmazonJPScraper();
export default amazonJPScraper;
