// ─────────────────────────────────────────────
// BuyerIQ — Base Scraper (Playwright + Web Unlocker)
// ─────────────────────────────────────────────
// Shared scraping logic: browser management,
// anti-detection, retry, error handling.
//
// Web Unlocker Mode (PROXY_ROTATION_URL with web_unlocker):
//   - Uses Bright Data HTTP API instead of Playwright proxy
//   - Bypasses Cloudflare automatically
//   - Falls back to Playwright for JS-heavy parsing
// ─────────────────────────────────────────────
import { chromium } from 'playwright';
import axios from 'axios';
import { load } from 'cheerio';
import { proxyManager } from '../../utils/proxy-manager.js';
import { getRandomUserAgent, getBrowserHeaders } from '../../utils/user-agents.js';
import { waitForRateLimit, randomDelay } from '../../utils/rate-limiter.js';
import { SCRAPER_CONFIG } from '../../config/constants.js';
import { createLogger } from '../../utils/logger.js';

// Detect if using Web Unlocker (zone-web_unlocker in URL)
const PROXY_URL = process.env.PROXY_ROTATION_URL || '';
const USE_WEB_UNLOCKER = PROXY_URL.includes('web_unlocker');
const BRIGHT_DATA_API_KEY = process.env.BRIGHT_DATA_API_KEY || '';

// Extract API key from proxy URL if not set separately
// Format: http://user:PASSWORD@host:port
function extractApiKey() {
  if (BRIGHT_DATA_API_KEY) return BRIGHT_DATA_API_KEY;
  try {
    const parsed = new URL(PROXY_URL);
    return parsed.password || '';
  } catch {
    return '';
  }
}

const BD_API_KEY = extractApiKey();

export class BaseScraper {
  constructor(name, options = {}) {
    this.name = name;
    this.log = createLogger(`scraper:${name}`);
    this.rateLimitSource = options.rateLimitSource || name.toUpperCase();
    this.timeout = options.timeout || SCRAPER_CONFIG.timeout;
    this.maxRetries = options.maxRetries || SCRAPER_CONFIG.maxRetries;
    this.browser = null;
    this.context = null;
    this.useWebUnlocker = USE_WEB_UNLOCKER && BD_API_KEY;

    if (this.useWebUnlocker) {
      this.log.info('Using Bright Data Web Unlocker API mode');
    }
  }

  /**
   * Fetch HTML via Bright Data Web Unlocker API
   * Bypasses Cloudflare, CAPTCHA automatically
   */
  async fetchViaWebUnlocker(url) {
    await waitForRateLimit(this.rateLimitSource);
    await randomDelay(SCRAPER_CONFIG.minDelay, SCRAPER_CONFIG.maxDelay);

    this.log.debug(`Web Unlocker fetch: ${url}`);

    const response = await axios.post('https://api.brightdata.com/request', {
      zone: 'web_unlocker1',
      url,
      format: 'raw',
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BD_API_KEY}`,
      },
      timeout: 60000,
    });

    if (response.status !== 200) {
      throw new Error(`Web Unlocker HTTP ${response.status} for ${url}`);
    }

    return response.data; // HTML string
  }

  /**
   * Parse HTML with cheerio (jQuery-like) - works with Web Unlocker responses
   */
  parseHTML(html) {
    return load(html);
  }

  /**
   * Launch browser with anti-detection measures
   * Used as fallback or for JS-heavy sites
   */
  async launch() {
    const launchOptions = proxyManager.getLaunchOptions();

    this.browser = await chromium.launch({
      ...launchOptions,
      headless: true,
    });

    this.context = await this.browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: getBrowserHeaders(),
    });

    // Block unnecessary resources to speed up scraping
    await this.context.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    this.log.info('Browser launched');
    return this.context;
  }

  /**
   * Create a new page with stealth settings
   */
  async newPage() {
    if (!this.context) await this.launch();

    const page = await this.context.newPage();
    page.setDefaultTimeout(this.timeout);

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    return page;
  }

  /**
   * Navigate to URL with rate limiting and random delay
   * If Web Unlocker mode: fetches HTML via API and injects into page
   */
  async goto(page, url, options = {}) {
    await waitForRateLimit(this.rateLimitSource);
    await randomDelay(SCRAPER_CONFIG.minDelay, SCRAPER_CONFIG.maxDelay);

    this.log.debug(`Navigating to: ${url}`);

    try {
      // Web Unlocker mode: fetch HTML via API, set content in page
      if (this.useWebUnlocker) {
        const html = await this.fetchViaWebUnlocker(url);
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: this.timeout });
        return { status: () => 200, ok: () => true };
      }

      // Normal Playwright mode
      const response = await page.goto(url, {
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: this.timeout,
      });

      if (response && response.status() >= 400) {
        throw new Error(`HTTP ${response.status()} for ${url}`);
      }

      return response;
    } catch (err) {
      this.log.error(`Navigation failed: ${url}`, { error: err.message });
      throw err;
    }
  }

  /**
   * Execute scraping function with retry logic
   */
  async withRetry(fn, retries = null) {
    const maxRetries = retries || this.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastError = err;
        this.log.warn(`Attempt ${attempt}/${maxRetries} failed: ${err.message}`);

        if (attempt < maxRetries) {
          const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Safe text extraction from selector
   */
  async getText(page, selector, fallback = null) {
    try {
      const el = await page.$(selector);
      if (!el) return fallback;
      const text = await el.textContent();
      return text?.trim() || fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Safe attribute extraction
   */
  async getAttr(page, selector, attr, fallback = null) {
    try {
      const el = await page.$(selector);
      if (!el) return fallback;
      return (await el.getAttribute(attr)) || fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Extract multiple elements matching selector
   */
  async getAll(page, selector, extractFn) {
    try {
      const elements = await page.$$(selector);
      const results = [];
      for (const el of elements) {
        try {
          const data = await extractFn(el);
          if (data) results.push(data);
        } catch (err) {
          this.log.debug(`Element extraction failed: ${err.message}`);
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  /**
   * Scroll page to load lazy content
   */
  async autoScroll(page, maxScrolls = 5) {
    for (let i = 0; i < maxScrolls; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1000);
    }
  }

  /**
   * Close browser and cleanup
   */
  async close() {
    try {
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      this.log.debug('Browser closed');
    } catch (err) {
      this.log.warn('Error closing browser', { error: err.message });
    } finally {
      this.browser = null;
      this.context = null;
    }
  }
}

export default BaseScraper;
