// ─────────────────────────────────────────────
// BuyerIQ — US Census Bureau API Connector v2
// ─────────────────────────────────────────────
import { BaseAPIConnector } from './base-api.connector.js';
import { createLogger } from '../../utils/logger.js';
import { TARGET_HS_CODES } from '../../config/constants.js';

const log = createLogger('census-connector');

// Census CTY_CODE → ISO3 mapping
const CENSUS_TO_ISO3 = {
  '5330': 'IND', '5700': 'CHN', '5520': 'VNM', '5490': 'THA',
  '5600': 'IDN', '5570': 'PHL', '5310': 'BGD', '5350': 'LKA',
  '4120': 'DEU', '4190': 'ITA', '4110': 'FRA', '4210': 'ESP',
  '4220': 'NLD', '4114': 'GBR', '4140': 'POL', '4150': 'SWE',
  '4199': 'PRT', '5800': 'JPN', '5820': 'KOR', '5870': 'TWN',
  '2010': 'CAN', '2050': 'MEX', '2080': 'BRA', '2220': 'ARG',
  '6040': 'AUS', '6030': 'NZL', '5040': 'ARE', '5030': 'SAU',
  '5070': 'TUR', '4713': 'UKR', '4621': 'RUS', '5010': 'ISR',
  '5060': 'EGY', '7600': 'ZAF', '0003': 'EUR', '0014': 'WLD',
};



export class CensusConnector extends BaseAPIConnector {
  constructor() {
    super('census', 'https://api.census.gov/data', {
      timeout: 30000,
      retryDelay: 2000,
    });
    this.apiKey = process.env.CENSUS_API_KEY;
  }

  // Fetch one HS code, one month
  async fetchImportsByHS(hsCode, year = null, month = null) {
    const targetYear = year || (new Date().getFullYear() - 1);
    const targetMonth = month ? String(month).padStart(2, '0') : null;
    const time = targetMonth ? `${targetYear}-${targetMonth}` : `${targetYear}-01`;

    try {
      const response = await this.client.get('/timeseries/intltrade/imports/hs', {
        params: {
          get: 'CTY_CODE,CTY_NAME,GEN_VAL_MO,GEN_QY1_MO,MONTH,YEAR',
          I_COMMODITY: hsCode,
          time,
          key: this.apiKey,
        },
      });

      const data = response.data;
      if (!Array.isArray(data) || data.length < 2) return [];

      const [headers, ...rows] = data;
      const records = rows.map(row => {
        const r = {};
        headers.forEach((h, i) => r[h] = row[i]);
        return r;
      });

      log.info(`Census: ${records.length} records for HS ${hsCode} ${time}`);
      return this.normalizeRecords(records, hsCode);

    } catch (err) {
      log.error(`Census fetch failed HS ${hsCode}: ${err.message}`);
      return [];
    }
  }

  // Fetch full year — all 12 months
  async fetchFullYear(hsCode, year = null) {
    const targetYear = year || (new Date().getFullYear() - 1);
    const allRecords = [];

    for (let month = 1; month <= 12; month++) {
      const records = await this.fetchImportsByHS(hsCode, targetYear, month);
      allRecords.push(...records);
      await new Promise(r => setTimeout(r, 1000));
    }

    log.info(`Census full year: ${allRecords.length} records for HS ${hsCode} ${targetYear}`);
    return allRecords;
  }

  // Fetch all HS codes — one month (quick scan)
  async fetchAll(year = null) {
    const allRecords = [];
    const targetYear = year || (new Date().getFullYear() - 1);

    log.info(`Census: fetching ${TARGET_HS_CODES.length} HS codes for ${targetYear}`);

    for (const hsCode of TARGET_HS_CODES) {
      // Fetch last 3 months for each HS code
      for (let month = 10; month <= 12; month++) {
        const records = await this.fetchImportsByHS(hsCode, targetYear, month);
        allRecords.push(...records);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    log.info(`Census total: ${allRecords.length} records`);
    return allRecords;
  }

  // Normalize to trade_statistics schema
  normalizeRecords(records, hsCode) {
    return records
      .filter(r => parseFloat(r.GEN_VAL_MO) > 0)
      .map(r => ({
        reporter_country: 'USA',
        partner_country: CENSUS_TO_ISO3[r.CTY_CODE] || r.CTY_CODE?.substring(0, 10),
        hs_code: hsCode,
        flow: 'import',
        year: parseInt(r.YEAR, 10),
        trade_value_usd: Math.round(parseFloat(r.GEN_VAL_MO)),
        quantity_kg: Math.round(parseFloat(r.GEN_QY1_MO) || 0),
        data_source: 'census_bureau',
      }));
  }
}

export default new CensusConnector();
