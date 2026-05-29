// ─────────────────────────────────────────────
// BuyerIQ — Frankfurter FX Connector
// ─────────────────────────────────────────────
// Free ECB-backed currency rates. No API key.
// Used for: Quote Builder, FOB conversion, price intel
// ─────────────────────────────────────────────
import { BaseAPIConnector } from './base-api.connector.js';

const BASE_URL = process.env.FRANKFURTER_BASE_URL || 'https://api.frankfurter.app';

// Currencies relevant for BuyerIQ's markets
const TARGET_CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'AED', 'SAR', 'SGD', 'SEK', 'NZD', 'INR'];

class FrankfurterConnector extends BaseAPIConnector {
  constructor() {
    super('frankfurter', BASE_URL, {
      rateLimitSource: 'FRANKFURTER',
      cacheTTL: 300, // 5 min cache (rates update frequently)
    });
  }

  /**
   * Get latest rates from INR to all target currencies
   */
  async getLatestRates(base = 'USD') {
    const data = await this.get('/latest', {
      from: base,
      to: TARGET_CURRENCIES.filter((c) => c !== base).join(','),
    });

    return {
      base: data.base,
      date: data.date,
      rates: data.rates,
      _source: 'frankfurter',
      _fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Get historical rates for a specific date
   */
  async getHistoricalRates(date, base = 'USD') {
    const data = await this.get(`/${date}`, {
      from: base,
      to: TARGET_CURRENCIES.filter((c) => c !== base).join(','),
    }, { cacheTTL: 86400 }); // Historical rates never change — cache 24h

    return {
      base: data.base,
      date: data.date,
      rates: data.rates,
      _source: 'frankfurter',
    };
  }

  /**
   * Get time series for FOB trend analysis
   */
  async getTimeSeries(startDate, endDate, base = 'USD', target = 'INR') {
    const data = await this.get(`/${startDate}..${endDate}`, {
      from: base,
      to: target,
    }, { cacheTTL: 3600 });

    return {
      base: data.base,
      start: data.start_date,
      end: data.end_date,
      rates: data.rates, // { "2024-01-01": { "INR": 83.2 }, ... }
      _source: 'frankfurter',
    };
  }

  /**
   * Convert amount between currencies using latest rate
   */
  async convert(amount, from, to) {
    const rates = await this.getLatestRates(from);
    const rate = rates.rates[to];
    if (!rate) throw new Error(`No rate available for ${from} → ${to}`);

    return {
      from,
      to,
      amount,
      converted: Math.round(amount * rate * 100) / 100,
      rate,
      date: rates.date,
    };
  }
}

export const frankfurterConnector = new FrankfurterConnector();
export default frankfurterConnector;
