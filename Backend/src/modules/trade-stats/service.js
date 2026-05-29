import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";

class TradeStatsService extends BaseRepository {
  constructor() {
    super("trade_statistics", ["reporter_country","partner_country","hs_code","year","flow"]);
  }

  async getSeasonalData({ hs_code, year } = {}) {
    const { query } = await import('../../config/database.js');

    const monthColumnCheck = await query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'trade_statistics'
          AND column_name = 'month'
      ) AS has_month
    `);

    if (!monthColumnCheck.rows?.[0]?.has_month) {
      return [];
    }
    let sql = `
      SELECT month, hs_code, SUM(trade_value_usd) as total
      FROM trade_statistics
      WHERE data_source = 'census_bureau'
      AND month IS NOT NULL
    `;
    const params = [];
    if (hs_code) { params.push(hs_code); sql += ' AND hs_code = $' + params.length; }
    if (year) { params.push(parseInt(year)); sql += ' AND year = $' + params.length; }
    sql += ' GROUP BY month, hs_code ORDER BY month';

    const { rows } = await query(sql, params);

    const monthly = {};
    rows.forEach(r => {
      const key = r.month;
      if (!monthly[key]) monthly[key] = { month: parseInt(r.month), total: 0, byHS: {} };
      const val = parseFloat(r.total) || 0;
      monthly[key].total += val;
      if (r.hs_code) monthly[key].byHS[r.hs_code] = (monthly[key].byHS[r.hs_code] || 0) + val;
    });

    return Object.values(monthly).sort((a, b) => a.month - b.month);
  }

  async getByIdentifier(identifier) {
    const record = await this.findById(identifier);
    if (!record) throw ApiError.notFound("TradeStats not found");
    return record;
  }
}

export default new TradeStatsService();
