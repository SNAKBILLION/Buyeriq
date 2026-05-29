// ─────────────────────────────────────────────
// BuyerIQ — UN COMTRADE API Connector v2.1
// ─────────────────────────────────────────────
import { BaseAPIConnector } from './base-api.connector.js';
import { TARGET_HS_CODES, PRIORITY_MARKETS, INDIA_CODE, COMTRADE_COUNTRY_CODES } from '../../config/constants.js';

const BASE_URL = process.env.COMTRADE_BASE_URL || 'https://comtradeapi.un.org/data/v1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class ComtradeConnector extends BaseAPIConnector {
  constructor() {
    super('comtrade', BASE_URL, {
      rateLimitSource: 'COMTRADE',
      cacheTTL: 86400,
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.COMTRADE_API_KEY || '',
      },
    });
  }

  _numericCode(isoCode) {
    return COMTRADE_COUNTRY_CODES[isoCode] || isoCode;
  }

  async _fetchOne({ hsCode, reporterCode, partnerCode, flowCode, period }) {
    const data = await this.get('/get/C/A/HS', {
      cmdCode: hsCode,
      reporterCode: this._numericCode(reporterCode),
      partnerCode: partnerCode === 'all' ? 'all' : this._numericCode(partnerCode),
      flowCode,
      period,
      maxRecords: 250,
      format: 'JSON',
      includeDesc: true,
    });
    return this._parseResponse(data);
  }

  async getIndiaExports(year) {
    const results = [];
    for (const hsCode of TARGET_HS_CODES) {
      for (const market of PRIORITY_MARKETS) {
        try {
          const records = await this._fetchOne({
            hsCode,
            reporterCode: INDIA_CODE,
            partnerCode: market.code,
            flowCode: 'X',
            period: year.toString(),
          });
          results.push(...records);
          this.log.info(`✓ India→${market.code} HS:${hsCode} — ${records.length} records`);
        } catch (e) {
          this.log.warn(`Skipping India→${market.code} HS:${hsCode}: ${e.message}`);
        }
        await sleep(1500);
      }
    }
    this.log.info(`India exports total: ${results.length} records`);
    return results;
  }

  async getUSImports(year) {
    const results = [];
    for (const hsCode of TARGET_HS_CODES) {
      try {
        const records = await this._fetchOne({
          hsCode,
          reporterCode: 'USA',
          partnerCode: 'all',
          flowCode: 'M',
          period: year.toString(),
        });
        results.push(...records);
        this.log.info(`✓ US imports HS:${hsCode} — ${records.length} records`);
      } catch (e) {
        this.log.warn(`Skipping US imports HS:${hsCode}: ${e.message}`);
      }
      await sleep(1500);
    }
    return results;
  }

  async getBilateralTrade(partnerCode, yearStart, yearEnd) {
    const period = this._buildPeriodRange(yearStart, yearEnd);
    const results = [];
    for (const hsCode of TARGET_HS_CODES) {
      try {
        const records = await this._fetchOne({
          hsCode,
          reporterCode: INDIA_CODE,
          partnerCode,
          flowCode: 'X',
          period,
        });
        results.push(...records);
      } catch (e) {
        this.log.warn(`Skipping bilateral ${partnerCode} HS:${hsCode}: ${e.message}`);
      }
      await sleep(1500);
    }
    return results;
  }

  async getTopExporters(importerCode, year) {
    try {
      const records = await this._fetchOne({
        hsCode: '4419',
        reporterCode: importerCode,
        partnerCode: 'all',
        flowCode: 'M',
        period: year.toString(),
      });
      return records.sort((a, b) => (b.primaryValue || 0) - (a.primaryValue || 0));
    } catch (e) {
      this.log.warn(`getTopExporters failed: ${e.message}`);
      return [];
    }
  }


  // Fetch all competitor countries exports to all priority markets
  // China, Vietnam, Indonesia, Thailand, Poland, Romania, Turkey, Mexico
  async getCompetitorExports(year) {
    const { COMPETITOR_ORIGINS } = await import('../../config/constants.js');
    const results = [];

    for (const competitor of COMPETITOR_ORIGINS) {
      for (const hsCode of TARGET_HS_CODES) {
        for (const market of PRIORITY_MARKETS.slice(0, 8)) { // top 8 markets
          try {
            const records = await this._fetchOne({
              hsCode,
              reporterCode: competitor.code,
              partnerCode: market.code,
              flowCode: 'X',
              period: year.toString(),
            });
            // Tag each record with competitor info
            records.forEach(r => {
              r._competitor = competitor.code;
              r._competitor_name = competitor.name;
            });
            results.push(...records);
            this.log.info(`✓ ${competitor.code}→${market.code} HS:${hsCode} — ${records.length} records`);
          } catch (e) {
            this.log.warn(`Skipping ${competitor.code}→${market.code} HS:${hsCode}: ${e.message}`);
          }
          await sleep(1500);
        }
      }
    }
    this.log.info(`Competitor exports total: ${results.length} records`);
    return results;
  }

  // Get market share comparison: India vs all competitors in one market
  async getMarketShareComparison(importerCode, hsCode, year) {
    try {
      const records = await this._fetchOne({
        hsCode,
        reporterCode: importerCode,
        partnerCode: 'all',
        flowCode: 'M',
        period: year.toString(),
      });

      // Calculate shares
      const total = records.reduce((sum, r) => sum + (r.primaryValue || 0), 0);
      const byCountry = {};

      records.forEach(r => {
        const country = r.partnerCode || r.partner_code || 'Unknown';
        byCountry[country] = (byCountry[country] || 0) + (r.primaryValue || 0);
      });

      return Object.entries(byCountry)
        .map(([country, value]) => ({
          country,
          value_usd: value,
          share_pct: total > 0 ? Math.round(value / total * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.value_usd - a.value_usd)
        .slice(0, 15); // top 15 exporters to this market
    } catch(e) {
      this.log.warn(`getMarketShareComparison failed: ${e.message}`);
      return [];
    }
  }

  _parseResponse(data) {
    if (!data || !data.data) return [];
    return data.data.map((record) => ({
      ...record,
      _source: 'comtrade',
      _fetchedAt: new Date().toISOString(),
    }));
  }

  _buildPeriodRange(start, end) {
    if (!start && !end) {
      const y = new Date().getFullYear();
      return `${y - 3},${y - 2},${y - 1}`;
    }
    if (!end) return start.toString();
    const years = [];
    for (let y = start; y <= end; y++) years.push(y);
    return years.join(',');
  }
}

export const comtradeConnector = new ComtradeConnector();
export default comtradeConnector;
