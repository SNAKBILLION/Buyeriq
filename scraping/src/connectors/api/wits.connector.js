// ─────────────────────────────────────────────
// BuyerIQ — World Bank WITS API Connector
// ─────────────────────────────────────────────
// Source: World Bank WITS (wits.worldbank.org)
// Data:   Tariff rates, trade flows, market access
// FREE — no API key needed
// Rate:   100 req/hr (conservative)
// ─────────────────────────────────────────────
import { BaseAPIConnector } from './base-api.connector.js';
import { cache } from '../../config/redis.js';
import { waitForRateLimit } from '../../utils/rate-limiter.js';
import { TARGET_HS_CODES, PRIORITY_MARKETS } from '../../config/constants.js';

const WITS_BASE = 'https://wits.worldbank.org/API/V1';

// India FTA advantages — known tariff advantages
export const INDIA_FTA_ADVANTAGES = {
  GBR: { rate: 0,    scheme: 'UK DCTS',        note: '0% under UK Developing Countries Trading Scheme' },
  AUS: { rate: 0,    scheme: 'AI-ECTA',         note: '0% under India-Australia Economic Cooperation' },
  ARE: { rate: 0,    scheme: 'India-UAE CEPA',  note: '0% under Comprehensive Economic Partnership' },
  JPN: { rate: 2.4,  scheme: 'India-Japan CEPA',note: 'Reduced from 5.9% MFN' },
  KOR: { rate: 0,    scheme: 'India-Korea CEPA',note: '0% for most HS 4419 products' },
  SGP: { rate: 0,    scheme: 'India-Singapore CECA', note: '0% under CECA' },
  MYS: { rate: 0,    scheme: 'ASEAN-India FTA', note: '0% under AIFTA' },
  THA: { rate: 0,    scheme: 'ASEAN-India FTA', note: '0% under AIFTA' },
};

export class WITSConnector extends BaseAPIConnector {
  constructor() {
    super('wits', WITS_BASE, {
      rateLimitSource: 'WITS',
      cacheTTL: 86400 * 7, // Cache 7 days — tariffs change slowly
      timeout: 30000,
    });
  }

  // ─────────────────────────────────────────
  // Get tariff rate: reporter imports from India
  // reporter = importing country (USA, GBR etc)
  // hsCode = HS code (4419, 7323 etc)
  // ─────────────────────────────────────────
  async getTariffRate(reporterISO3, hsCode, year = 2023) {
    const cacheKey = `wits:tariff:${reporterISO3}:${hsCode}:${year}`;

    try {
      // Check cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        this.log.debug(`Cache hit: ${cacheKey}`);
        return JSON.parse(cached);
      }

      await waitForRateLimit('WITS');

      const response = await this.client.get(
        `/SDMX/V21/datasource/TRN/reporter/${this._getNumericCode(reporterISO3)}/partner/699/product/${hsCode.padEnd(6,"0").substring(0,6)}/year/${year}`,
        { params: { format: 'JSON' } }
      );

      const data = this._parseTariffResponse(response.data, reporterISO3, hsCode);

      // Cache result
      await cache.set(cacheKey, JSON.stringify(data), 'EX', this.cacheTTL);

      this.log.info(`WITS tariff: ${reporterISO3} ← IND HS ${hsCode} = ${data.mfn_rate}% MFN, ${data.preferential_rate}% pref`);
      return data;

    } catch (err) {
      // Fallback to known FTA data
      const fta = INDIA_FTA_ADVANTAGES[reporterISO3];
      if (fta) {
        this.log.info(`WITS fallback to FTA data: ${reporterISO3} = ${fta.rate}%`);
        return {
          reporter: reporterISO3,
          hs_code: hsCode,
          mfn_rate: null,
          preferential_rate: fta.rate,
          scheme: fta.scheme,
          note: fta.note,
          source: 'fta_hardcoded',
        };
      }
      this.log.warn(`WITS tariff failed ${reporterISO3} HS ${hsCode}: ${err.message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────
  // Get all tariffs for India → priority markets
  // Returns full tariff advantage map
  // ─────────────────────────────────────────
  async getAllTariffAdvantages(hsCodes = null) {
    const codes = hsCodes || TARGET_HS_CODES;
    const results = [];

    this.log.info(`WITS: Fetching tariffs for ${codes.length} HS codes × ${PRIORITY_MARKETS.length} markets`);

    for (const market of PRIORITY_MARKETS) {
      for (const hsCode of codes) {
        const tariff = await this.getTariffRate(market.code, hsCode);
        if (tariff) {
          results.push({
            ...tariff,
            market_name: market.name,
            priority: market.priority,
          });
        }
        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
      }
    }

    this.log.info(`WITS: ${results.length} tariff records fetched`);
    return results;
  }

  // ─────────────────────────────────────────
  // Get India's market share vs competitors
  // in a specific market + HS code
  // ─────────────────────────────────────────
  async getCompetitorShares(reporterISO3, hsCode, year = 2023) {
    const cacheKey = `wits:shares:${reporterISO3}:${hsCode}:${year}`;

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return JSON.parse(cached);

      await waitForRateLimit('WITS');

      const response = await this.client.get(
        `/data/trade/indicators/${reporterISO3}/ALL/${hsCode}/ALL/${year}`,
        { params: { format: 'JSON', indicator: 'MPRT-TRD-VL' } }
      );

      const shares = this._parseShareResponse(response.data);
      await cache.set(cacheKey, JSON.stringify(shares), 'EX', this.cacheTTL);

      return shares;

    } catch (err) {
      this.log.warn(`WITS shares failed ${reporterISO3} HS ${hsCode}: ${err.message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────
  // Parse WITS tariff JSON response
  // ─────────────────────────────────────────

  _getNumericCode(iso3) {
    const codes = {
      USA: '842', GBR: '826', DEU: '276', NLD: '528',
      AUS: '036', CAN: '124', FRA: '251', JPN: '392',
      ARE: '784', SAU: '682', SGP: '702', NZL: '554',
      SWE: '752', CHN: '156', VNM: '704',
    };
    return codes[iso3] || iso3;
  }

  _parseTariffResponse(data, reporter, hsCode) {
    try {
      const obs = data?.structure?.observations || data?.dataSets?.[0]?.observations || {};
      const values = Object.values(obs);
      if (!values.length) return null;

      // Extract MFN and preferential rates
      let mfnRate = null;
      let prefRate = null;

      values.forEach(v => {
        const val = parseFloat(v[0]);
        if (!isNaN(val)) {
          if (mfnRate === null || val > mfnRate) mfnRate = val;
          if (prefRate === null || val < prefRate) prefRate = val;
        }
      });

      // Check known FTA
      const fta = INDIA_FTA_ADVANTAGES[reporter];

      return {
        reporter,
        hs_code: hsCode,
        mfn_rate: mfnRate,
        preferential_rate: fta ? fta.rate : prefRate,
        scheme: fta ? fta.scheme : 'MFN',
        note: fta ? fta.note : null,
        india_advantage: fta ? `${mfnRate - fta.rate}% advantage` : null,
        source: 'wits_api',
      };
    } catch (err) {
      this.log.warn(`Parse error: ${err.message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────
  // Parse market share response
  // ─────────────────────────────────────────
  _parseShareResponse(data) {
    try {
      const series = data?.structure?.series || {};
      const shares = [];

      Object.entries(series).forEach(([key, val]) => {
        const countryCode = key.split(':')[2];
        const obs = val?.observations || {};
        const latestValue = Object.values(obs).pop()?.[0];
        if (latestValue && countryCode) {
          shares.push({
            country: countryCode,
            value_usd: parseFloat(latestValue) || 0,
          });
        }
      });

      // Sort by value descending
      shares.sort((a, b) => b.value_usd - a.value_usd);

      // Calculate shares
      const total = shares.reduce((sum, s) => sum + s.value_usd, 0);
      return shares.map(s => ({
        ...s,
        share_pct: total > 0 ? Math.round(s.value_usd / total * 100 * 10) / 10 : 0,
      }));

    } catch (err) {
      return [];
    }
  }
}

export const witsConnector = new WITSConnector();
export default witsConnector;
