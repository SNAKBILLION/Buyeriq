// ─────────────────────────────────────────────
// BuyerIQ — Proxy Manager
// ─────────────────────────────────────────────
import { createLogger } from './logger.js';

const log = createLogger('proxy-manager');

/**
 * Manages proxy rotation for scraping workers.
 * Supports: direct proxies, rotating proxy services, no-proxy mode.
 */
class ProxyManager {
  constructor() {
    this.enabled = process.env.PROXY_ENABLED === 'true';
    this.proxies = [];
    this.currentIndex = 0;
    this.failures = new Map(); // proxy -> failure count

    if (this.enabled) {
      this._loadProxies();
    }
  }

  _loadProxies() {
    // Single rotating proxy service (like BrightData, ScraperAPI)
    if (process.env.PROXY_ROTATION_URL) {
      this.proxies = [process.env.PROXY_ROTATION_URL];
      this.mode = 'rotating-service';
      log.info('Proxy mode: rotating service');
      return;
    }

    // Static proxy list from env (comma-separated)
    if (process.env.PROXY_URL) {
      this.proxies = process.env.PROXY_URL.split(',').map((p) => p.trim());
      this.mode = 'static-list';
      log.info(`Proxy mode: static list (${this.proxies.length} proxies)`);
      return;
    }

    log.warn('Proxy enabled but no PROXY_URL or PROXY_ROTATION_URL configured');
    this.enabled = false;
  }

  /**
   * Get next proxy URL for Playwright or axios.
   * Returns null if proxies are disabled.
   */
  getProxy() {
    if (!this.enabled || this.proxies.length === 0) return null;

    if (this.mode === 'rotating-service') {
      return { server: this.proxies[0] };
    }

    // Round-robin through static list, skipping failed ones
    const maxAttempts = this.proxies.length;
    for (let i = 0; i < maxAttempts; i++) {
      const proxy = this.proxies[this.currentIndex % this.proxies.length];
      this.currentIndex++;

      const failures = this.failures.get(proxy) || 0;
      if (failures < 5) {
        return this._parseProxy(proxy);
      }
    }

    // All proxies failed — reset and try first
    log.warn('All proxies have high failure counts, resetting');
    this.failures.clear();
    return this._parseProxy(this.proxies[0]);
  }

  /**
   * Parse proxy URL into Playwright format
   * Supports: http://user:pass@host:port or http://host:port
   */
  _parseProxy(url) {
    try {
      const parsed = new URL(url);
      const result = { server: `${parsed.protocol}//${parsed.hostname}:${parsed.port}` };
      if (parsed.username) {
        result.username = parsed.username;
        result.password = parsed.password;
      }
      return result;
    } catch {
      return { server: url };
    }
  }

  /**
   * Report proxy success/failure for adaptive rotation
   */
  reportSuccess(proxy) {
    if (proxy?.server) {
      this.failures.delete(proxy.server);
    }
  }

  reportFailure(proxy) {
    if (proxy?.server) {
      const count = (this.failures.get(proxy.server) || 0) + 1;
      this.failures.set(proxy.server, count);
      log.warn(`Proxy failure recorded: ${proxy.server} (${count} total)`);
    }
  }

  /**
   * Get Playwright browser launch options with proxy
   */
  getLaunchOptions() {
    const proxy = this.getProxy();
    const options = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
    if (proxy) {
      options.proxy = proxy;
    }
    return options;
  }
}

export const proxyManager = new ProxyManager();
export default proxyManager;
