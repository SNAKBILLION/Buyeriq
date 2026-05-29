// ─────────────────────────────────────────────
// BuyerIQ — Alibaba Supplier Scraper (Cheerio + Web Unlocker)
// Rewritten: No Playwright, same as Amazon pattern
// ─────────────────────────────────────────────
import { BaseScraper } from './base.scraper.js';
import axios from 'axios';
import { load } from 'cheerio';

class AlibabaScraper extends BaseScraper {
  constructor() {
    super('alibaba', { rateLimitSource: 'ALIBABA' });
    this.baseUrl = 'https://www.alibaba.com';
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
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
      timeout: 30000,
    });
    return typeof response.data === 'string' ? response.data : String(response.data);
  }

  async searchSuppliers(keyword, maxPages = 2) {
    const allResults = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const url = `${this.baseUrl}/trade/search?SearchText=${encodeURIComponent(keyword)}&page=${pageNum}`;
      this.log.info(`Alibaba: Searching "${keyword}" page ${pageNum}`);

      try {
        const html = await this._fetchHTML(url);
        if (!html || String(html).length < 1000) continue;

        const $ = load(html);
        const products = [];

        // Alibaba search result cards
        $('[class*="fy23-search-card"], [class*="list-no-v2-outter"], [class*="organic-gallery-offer"], .J-offer-wrapper').each((i, el) => {
          const title = $(el).find('[class*="elements-title-normal"], h2 a, [class*="title"] a').first().text().trim() || null;
          if (!title) return;

          const priceText = $(el).find('[class*="elements-offer-price"], [class*="price"]').first().text().trim() || null;
          const moqText = $(el).find('[class*="element-offer-minorder"], [class*="min-order"]').first().text().trim() || null;
          const supplier = $(el).find('[class*="seller-tag__title"], [class*="company-name"] a').first().text().trim() || null;
          const location = $(el).find('[class*="seller-tag__country"], [class*="country"]').first().text().trim() || null;
          const yearsText = $(el).find('[class*="seller-tag__year"], [class*="year-tag"]').first().text().trim() || null;
          const isVerified = $(el).find('[class*="verified"], [class*="trade-assurance"]').length > 0;
          const link = $(el).find('a[href*="/product-detail"], a[href*="offer"]').first().attr('href') || null;
          const imgSrc = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src') || null;

          // Parse price range
          let priceMin = null, priceMax = null;
          if (priceText) {
            const prices = priceText.match(/[\d,.]+/g);
            if (prices && prices.length >= 1) priceMin = parseFloat(prices[0].replace(',', ''));
            if (prices && prices.length >= 2) priceMax = parseFloat(prices[1].replace(',', ''));
          }

          // Parse MOQ
          let moq = null;
          if (moqText) {
            const moqMatch = moqText.match(/[\d,]+/);
            moq = moqMatch ? parseInt(moqMatch[0].replace(',', ''), 10) : null;
          }

          products.push({
            title,
            price_min: priceMin,
            price_max: priceMax,
            price_range: priceText,
            moq,
            moq_text: moqText,
            supplier_name: supplier,
            location,
            years_on_alibaba: yearsText ? parseInt(yearsText.match(/\d+/)?.[0] || '0', 10) : null,
            is_verified: isVerified,
            product_url: link ? (link.startsWith('http') ? link : `${this.baseUrl}${link}`) : null,
            image_url: imgSrc,
            _source: 'alibaba',
            _keyword: keyword,
            _page: pageNum,
            _fetchedAt: new Date().toISOString(),
          });
        });

        allResults.push(...products);
        this.log.info(`Alibaba page ${pageNum}: ${products.length} listings`, { keyword });

      } catch (err) {
        this.log.error(`Alibaba page ${pageNum} failed: ${err.message}`);
      }
    }

    return allResults;
  }
}

export const alibabaScraper = new AlibabaScraper();
export default alibabaScraper;
