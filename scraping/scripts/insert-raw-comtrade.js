#!/usr/bin/env node
// BuyerIQ — Raw COMTRADE JSON → DB Insert
// raw-data/trade/comtrade/ folder ki saari files DB mein daal do

import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  BuyerIQ — Raw COMTRADE Data → DB');
  console.log('═══════════════════════════════════════════════\n');

  await pool.query('SELECT 1');
  console.log('✅ DB connected\n');

  // Saari raw comtrade files dhundho
  const RAW_DIR = path.join(process.cwd(), 'raw-data', 'trade', 'comtrade');
  
  if (!fs.existsSync(RAW_DIR)) {
    console.error('❌ raw-data/trade/comtrade/ folder nahi mila');
    await pool.end();
    return;
  }

  // Saare date folders
  const dateFolders = fs.readdirSync(RAW_DIR)
    .filter(f => fs.statSync(path.join(RAW_DIR, f)).isDirectory())
    .sort();

  console.log(`📁 Found folders: ${dateFolders.join(', ')}\n`);

  let totalFiles = 0;
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const dateFolder of dateFolders) {
    const folderPath = path.join(RAW_DIR, dateFolder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
    
    console.log(`📂 ${dateFolder}: ${files.length} files`);

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(folderPath, file);
      
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(raw);
        
        const meta = json._meta || {};
        const records = json.data || [];
        
        console.log(`  📄 ${meta.query || file}: ${records.length} records`);

        for (const rec of records) {
          try {
            // COMTRADE field names
            const reporterISO = rec.reporterISO || rec.reporter_iso;
            const partnerISO  = rec.partnerISO  || rec.partner_iso;
            const cmdCode     = rec.cmdCode     || rec.cmd_code;
            const period      = rec.refYear     || rec.period;
            const flowCode    = rec.flowCode    || rec.flow_code;
            const primaryValue = parseFloat(rec.fobvalue || rec.primaryValue || 0);
            const qty         = parseFloat(rec.qty || rec.netWgt || 0);

            if (!reporterISO || !partnerISO || !cmdCode || !period || primaryValue <= 0) {
              totalSkipped++;
              continue;
            }

            const flow = flowCode === 'X' ? 'export' : 'import';
            const avgPrice = qty > 0 ? primaryValue / qty : null;

            await pool.query(`
              INSERT INTO trade_statistics
                (reporter_country, partner_country, hs_code, year, flow,
                 trade_value_usd, quantity_kg, avg_unit_price, data_source, confidence)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'comtrade','verified')
              ON CONFLICT (reporter_country, partner_country, hs_code, year, flow)
              DO UPDATE SET
                trade_value_usd = GREATEST(trade_statistics.trade_value_usd, EXCLUDED.trade_value_usd),
                quantity_kg     = GREATEST(trade_statistics.quantity_kg, EXCLUDED.quantity_kg),
                avg_unit_price  = EXCLUDED.avg_unit_price,
                updated_at      = NOW()
            `, [
              reporterISO, partnerISO, cmdCode,
              parseInt(period), flow,
              Math.round(primaryValue), Math.round(qty), avgPrice
            ]);
            totalInserted++;

          } catch (err) {
            totalSkipped++;
          }
        }

      } catch (err) {
        console.warn(`  ⚠️  ${file}: ${err.message.substring(0, 60)}`);
      }
    }
  }

  // Final status
  const total = await pool.query('SELECT COUNT(*) as total FROM trade_statistics');
  const byReporter = await pool.query(`
    SELECT reporter_country, COUNT(*) as count, 
           COUNT(DISTINCT hs_code) as hs_codes,
           COUNT(DISTINCT partner_country) as markets
    FROM trade_statistics
    WHERE data_source = 'comtrade'
    GROUP BY reporter_country
    ORDER BY count DESC
    LIMIT 10
  `);

  console.log(`\n✅ Done!`);
  console.log(`   Files processed: ${totalFiles}`);
  console.log(`   Records inserted/updated: ${totalInserted}`);
  console.log(`   Records skipped: ${totalSkipped}`);
  console.log(`   Total DB records now: ${total.rows[0].total}`);
  
  if (byReporter.rows.length > 0) {
    console.log(`\n📊 COMTRADE data by reporter:`);
    byReporter.rows.forEach(r => {
      console.log(`   ${r.reporter_country}: ${r.count} records | ${r.hs_codes} HS codes | ${r.markets} markets`);
    });
  }

  // Recalculate competitor FOB
  console.log('\n💰 Recalculating competitor CIF unit values rates...');
  
  const fobResult = await pool.query(`
    WITH competitor_data AS (
      SELECT
        reporter_country AS country,
        hs_code,
        SUM(trade_value_usd) AS total_value,
        SUM(quantity_kg) AS total_kg,
        MAX(year) AS latest_year,
        COUNT(*) AS data_points
      FROM trade_statistics
      WHERE
        reporter_country IN ('CHN', 'VNM', 'IND', 'IDN', 'THA')
        AND hs_code IN ('4419', '4420', '4602')
        AND quantity_kg > 0
        AND trade_value_usd > 0
        AND year >= 2020
      GROUP BY reporter_country, hs_code
    )
    SELECT
      country, hs_code,
      ROUND((total_value / NULLIF(total_kg, 0))::numeric, 4) AS avg_cif_per_kg,
      total_value, total_kg, data_points, latest_year
    FROM competitor_data
    ORDER BY hs_code, country
  `);

  if (fobResult.rows.length > 0) {
    // Table ensure
    await pool.query(`
      CREATE TABLE IF NOT EXISTS competitor_cif_rates (
        id SERIAL PRIMARY KEY,
        country VARCHAR(3) NOT NULL,
        hs_code VARCHAR(10) NOT NULL,
        avg_cif_per_kg DECIMAL(10,4),
        total_value_usd DECIMAL(15,2),
        total_kg DECIMAL(15,2),
        data_points INTEGER,
        latest_year INTEGER,
        calculated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(country, hs_code)
      )
    `);

    for (const row of fobResult.rows) {
      await pool.query(`
        INSERT INTO competitor_cif_rates
          (country, hs_code, avg_cif_per_kg, total_value_usd, total_kg, data_points, latest_year)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (country, hs_code) DO UPDATE SET
          avg_cif_per_kg = EXCLUDED.avg_cif_per_kg,
          total_value_usd = EXCLUDED.total_value_usd,
          total_kg = EXCLUDED.total_kg,
          data_points = EXCLUDED.data_points,
          latest_year = EXCLUDED.latest_year,
          calculated_at = NOW()
      `, [row.country, row.hs_code, row.avg_cif_per_kg, row.total_value, row.total_kg, row.data_points, row.latest_year]);
    }

    console.log(`✅ ${fobResult.rows.length} CIF rates updated\n`);
    
    // Per piece
    const WEIGHTS = {
      '4419': 0.8, '7323': 8.0, '7013': 3.0,
      '6911': 6.0, '6912': 2.0, '7615': 5.0,
      '4602': 0.6, '8215': 0.8, '7418': 1.6,
    };
    
    const byHS = {};
    fobResult.rows.forEach(r => {
      if (!byHS[r.hs_code]) byHS[r.hs_code] = {};
      byHS[r.hs_code][r.country] = parseFloat(r.avg_cif_per_kg);
    });

    console.log('📦 Competitor CIF per piece (FOB ~10-15% lower):');
    Object.entries(WEIGHTS).forEach(([hs, wt]) => {
      if (!byHS[hs]) return;
      console.log(`\n  HS ${hs} (~${wt}kg/pc):`);
      Object.entries(byHS[hs]).forEach(([country, rate]) => {
        const flags = { CN:'🇨🇳', IN:'🇮🇳', VN:'🇻🇳', ID:'🇮🇩', TH:'🇹🇭', IND:'🇮🇳', CHN:'🇨🇳', VNM:'🇻🇳', IDN:'🇮🇩' };
        console.log(`    ${flags[country] || ''} ${country}: $${rate.toFixed(3)}/kg → $${(rate * wt).toFixed(2)}/pc`);
      });
    });
  }

  await pool.end();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
