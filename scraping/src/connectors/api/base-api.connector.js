// ─────────────────────────────────────────────
// BuyerIQ — Base API Connector
// ─────────────────────────────────────────────
// Shared logic for all REST API connectors:
// retry, rate limiting, caching, error handling.
// ─────────────────────────────────────────────
import axios from 'axios';
import { waitForRateLimit } from '../../utils/rate-limiter.js';
import { cache } from '../../config/redis.js';
import { createLogger } from '../../utils/logger.js';

export class BaseAPIConnector {
  constructor(name, baseURL, options = {}) {
    this.name = name;
    this.log = createLogger(`api:${name}`);
    this.cacheTTL = options.cacheTTL || 3600;
    this.rateLimitSource = options.rateLimitSource || name.toUpperCase();

    this.client = axios.create({
      baseURL,
      timeout: options.timeout || 30000,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use((config) => {
      this.log.debug(`→ ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
      });
      return config;
    });

    // Response interceptor
    this.client.interceptors.response.use(
      (res) => {
        this.log.debug(`← ${res.status} ${res.config.url}`, {
          dataSize: JSON.stringify(res.data).length,
        });
        return res;
      },
      (err) => {
        this.log.error(`✗ ${err.response?.status || 'NETWORK'} ${err.config?.url}`, {
          message: err.message,
        });
        throw err;
      }
    );
  }

  /**
   * Make a rate-limited, cached GET request
   */
  async get(endpoint, params = {}, options = {}) {
    const cacheKey = options.cacheKey || this._buildCacheKey(endpoint, params);
    const ttl = options.cacheTTL ?? this.cacheTTL;

    // Check cache first
    if (ttl > 0) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        this.log.debug(`Cache hit: ${cacheKey}`);
        return cached;
      }
    }

    // Rate limit check
    await waitForRateLimit(this.rateLimitSource);

    // Make request with retry
    const response = await this._retry(
      () => this.client.get(endpoint, { params }),
      options.retries || 3
    );

    const data = response.data;

    // Cache the result
    if (ttl > 0) {
      await cache.set(cacheKey, data, ttl);
    }

    return data;
  }

  /**
   * Retry logic with exponential backoff
   */
  async _retry(fn, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const status = err.response?.status;

        // Don't retry client errors (except 429)
        if (status && status >= 400 && status < 500 && status !== 429) {
          throw err;
        }

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
          this.log.warn(`Retry ${attempt}/${maxRetries} in ${Math.round(delay)}ms`, {
            status,
            error: err.message,
          });
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  _buildCacheKey(endpoint, params) {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `api:${this.name}:${endpoint}:${paramStr}`;
  }
}

export default BaseAPIConnector;
