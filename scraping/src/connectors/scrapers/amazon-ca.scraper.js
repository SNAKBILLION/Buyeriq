import { BaseScraper } from './base.scraper.js';
import axios from 'axios';
import { load } from 'cheerio';

function detectMaterial(title) {
  const t = title.toLowerCase();
  if (t.includes('bamboo')) return 'bamboo';
  if (t.includes('acacia')) return 'acacia';
  if (t.includes('teak')) return 'teak';
  if (t.includes('walnut')) return 'walnut';
  if (t.includes('mango')) return 'mango';
  if (t.includes('wood') || t.includes('wooden')) return 'wood';
  return null;
}

function extractSize(title) {
  const match = title.match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)\s*(?:cm|inch|")?/);
  if (match) return `${match[1]}x${match[2]}`;
  const setMatch = title.match(/set of (\d+)|(\d+)[- ]?pack|(\d+)[- ]?piece/i);
  if (setMatch) return `Set of ${setMatch[1] || setMatch[2] || setMatch[3]}`;
  return null;
}

class AmazonCAScraper extends BaseScraper {
  constructor() {
    super('amazon-ca', { rateLimitSource: 'AMAZON_CA' });
    this.baseUrl = 'https://www.amazon.ca';
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
      this.log.info(`Amazon CA: Searching "${keyword}" page ${pageNum}`);
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
          const priceFrac = $(el).find('.a-price-fraction').first().text().replace(/[^0-9]/g, '') || '00';
          const price = priceWhole ? parseFloat(`${priceWhole}.${priceFrac}`) : null;
          if (!price || price <= 0) return;
          const ratingText = $(el).find('.a-icon-alt').first().text();
          const rating = ratingText ? parseFloat(ratingText.match(/[\d.]+/)?.[0]) : null;
          const reviewLabel = $(el).find('[aria-label*="ratings"]').first().attr('aria-label') || '';
          const reviewCount = reviewLabel ? parseInt(reviewLabel.replace(/[^0-9]/g, ''), 10) || null : null;
          const imageUrl = $(el).find('.s-image').attr('src') || null;
          const productUrl = `${this.baseUrl}/dp/${asin}`;
          const byline = $(el).find('.a-size-base-plus').first().text().trim();
          const brand = byline && byline.length < 50 ? byline : null;
          const material = detectMaterial(title);
          const size = extractSize(title);
          products.push({
            asin, title, price, currency: 'CAD', rating,
            review_count: reviewCount, image_url: imageUrl,
            url: productUrl, brand, material, size,
            platform: 'amazon_ca', _source: 'amazon_ca',
            _keyword: keyword, _page: pageNum,
          });
        });
        allProducts.push(...products);
        this.log.info(`Amazon CA page ${pageNum}: ${products.length} products`, { keyword });
      } catch (err) {
        this.log.error(`Amazon CA page ${pageNum} failed: ${err.message}`);
      }
    }
    return allProducts;
  }
}

export const amazonCAScraper = new AmazonCAScraper();
export default amazonCAScraper;
