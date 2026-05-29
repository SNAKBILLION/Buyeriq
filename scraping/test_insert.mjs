import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const COMTRADE_TO_ISO3 = {
  '699':'IND','842':'USA','826':'GBR','276':'DEU','528':'NLD',
  '36':'AUS','124':'CAN','392':'JPN','784':'ARE','682':'SAU',
};
const toISO = (code) => COMTRADE_TO_ISO3[String(code)] || String(code);

try {
  const result = await pool.query(`
    INSERT INTO trade_statistics
      (reporter_country, partner_country, hs_code, year, month, flow,
       trade_value_usd, quantity_kg, avg_unit_price, data_source, confidence)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'comtrade','verified')
    ON CONFLICT (reporter_country, partner_country, hs_code, year, month, flow, data_source)
    DO UPDATE SET trade_value_usd = EXCLUDED.trade_value_usd, updated_at = NOW()
    RETURNING id
  `, ['IND','USA','4419',2020,null,'export',100000,1000,100]);
  console.log('✅ Insert worked! ID:', result.rows[0]?.id);
} catch(err) {
  console.error('❌ Error:', err.message);
  console.error('Detail:', err.detail);
  console.error('Code:', err.code);
}
await pool.end();
