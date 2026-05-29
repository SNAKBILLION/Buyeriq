content = open('scripts/fetch-all-data.js').read()

old = """  const insertRecord = async (rec) => {
    try {
      const val = rec.primaryValue || rec.fobvalue || 0;
      const wgt = rec.netWgt || rec.qty || 0;
      const avgPrice = wgt > 0 ? val / wgt : null;
      await pool.query(`
        INSERT INTO trade_statistics
          (reporter_country, partner_country, hs_code, year, flow,
           trade_value_usd, quantity_kg, avg_unit_price, data_source, confidence)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'comtrade','verified')
        ON CONFLICT (reporter_country, partner_country, hs_code, year, month, flow, data_source)
        DO UPDATE SET
          trade_value_usd = EXCLUDED.trade_value_usd,
          quantity_kg     = EXCLUDED.quantity_kg,
          avg_unit_price  = EXCLUDED.avg_unit_price,
          updated_at      = NOW()
      `, [
        rec.reporterISO || toISO(rec.reporterCode || rec.reporter_code),
        rec.partnerISO  || toISO(rec.partnerCode  || rec.partner_code),
        (rec.cmdCode || rec.hs_code || '').substring(0, 4),
        parseInt(rec.period || rec.refYear || rec.year),
        rec.flowCode === 'X' ? 'export' : 'import',
        Math.round(val),
        Math.round(wgt),
        avgPrice,
      ]);
      totalInserted++;
    } catch (err) {
      console.error("Insert error:", err.message, err.detail);
    }
  };"""

new = """  const insertRecord = async (rec) => {
    try {
      const val = rec.primaryValue || rec.fobvalue || 0;
      const wgt = rec.netWgt || rec.qty || 0;
      const avgPrice = wgt > 0 ? val / wgt : null;
      const reporter = rec.reporterISO || toISO(rec.reporterCode || rec.reporter_code);
      const partner  = rec.partnerISO  || toISO(rec.partnerCode  || rec.partner_code);
      const hs       = (rec.cmdCode || rec.hs_code || '').substring(0, 4);
      const yr       = parseInt(rec.period || rec.refYear || rec.year);
      const flow     = rec.flowCode === 'X' ? 'export' : 'import';

      // Check duplicate first (month=NULL for COMTRADE yearly data)
      const chk = await pool.query(
        'SELECT id FROM trade_statistics WHERE reporter_country=$1 AND partner_country=$2 AND hs_code=$3 AND year=$4 AND month IS NULL AND flow=$5 AND data_source=$6',
        [reporter, partner, hs, yr, flow, 'comtrade']
      );
      if (chk.rows.length > 0) return; // Skip duplicate

      await pool.query(
        'INSERT INTO trade_statistics (reporter_country,partner_country,hs_code,year,month,flow,trade_value_usd,quantity_kg,avg_unit_price,data_source,confidence) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10)',
        [reporter, partner, hs, yr, flow, Math.round(val), Math.round(wgt), avgPrice, 'comtrade', 'verified']
      );
      totalInserted++;
    } catch (err) {
      console.error("Insert error:", err.message, err.detail);
    }
  };"""

if old in content:
    open('scripts/fetch-all-data.js','w').write(content.replace(old,new,1))
    print('Fixed!')
else:
    print('Not found - check exact spacing')
