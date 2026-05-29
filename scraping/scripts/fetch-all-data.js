#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  BuyerIQ — Complete Data Fetch Script
//  Census Bureau + COMTRADE — All HS Codes
//
//  Kya karta hai:
//  1. Census se USA imports — saare HS codes — 2020-2024
//     (China, India, Vietnam, Indonesia, Thailand etc. ka data)
//  2. COMTRADE se India exports — saare priority markets ko
//  3. DB mein save karta hai
//  4. Competitor avg CIF unit value per HS code calculate karta hai
//
//  Run karo:
//  cd scraping
//  node scripts/fetch-all-data.js              ← sab kuch
//  node scripts/fetch-all-data.js --census     ← sirf Census
//  node scripts/fetch-all-data.js --comtrade   ← sirf COMTRADE
//  node scripts/fetch-all-data.js --unit-values        ← sirf FOB calculate
//  node scripts/fetch-all-data.js --status     ← DB mein kya hai
// ═══════════════════════════════════════════════════════════════════════

import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const args = process.argv.slice(2);
const RUN_CENSUS   = args.includes('--census')   || args.length === 0;
const RUN_COMTRADE = args.includes('--comtrade') || args.length === 0;
const RUN_FOB      = args.includes('--fob') || args.includes('--unit-values')      || args.length === 0;
const RUN_STATUS   = args.includes('--status');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── HS Codes to fetch ────────────────────────────────────────────────
// Tere saare 31 products ke HS codes
const HS_CODES_4DIGIT = ['4419', '4420', '7323', '7013', '6911', '6912', '7615', '4602', '8215', '7418', '4205'];
const HS_CODES_6DIGIT = [
  '441900', '441910', '441990',   // Wood kitchenware
  '442010', '442090',              // Wood ornamental
  '732391', '732393', '732394',   // Steel cookware
  '701310', '701349', '701399',   // Glass
  '691110', '691190',              // Ceramic porcelain
  '691200',                        // Stoneware
  '761510', '761590',              // Aluminum
  '460210',                        // Bamboo
  '821510',                        // Wood-handle spoons
  '741810',                        // Copper
  '420500', '420590',              // Leather handle articles
];

// ── Countries ─────────────────────────────────────────────────────────
const PRIORITY_MARKETS = ['USA', 'GBR', 'DEU', 'NLD', 'AUS', 'CAN', 'FRA', 'JPN', 'ARE'];
const COMPETITOR_COUNTRIES = ['CHN', 'VNM', 'IDN', 'THA', 'PHL'];

// ── Census CTY_CODE → ISO3 ────────────────────────────────────────────
const CENSUS_TO_ISO3 = {
  '5330': 'IND', '5700': 'CHN', '5520': 'VNM', '5490': 'THA',
  '5600': 'IDN', '5570': 'PHL', '5310': 'BGD', '5350': 'LKA',
  '4120': 'DEU', '4190': 'ITA', '4110': 'FRA', '4210': 'ESP',
  '4220': 'NLD', '4114': 'GBR', '4140': 'POL', '4150': 'SWE',
  '5800': 'JPN', '5820': 'KOR', '2010': 'CAN', '2050': 'MEX',
  '6040': 'AUS', '6030': 'NZL', '5040': 'ARE', '5030': 'SAU',
  '7600': 'ZAF', '0014': 'WLD',
};

// ── COMTRADE Country Codes ────────────────────────────────────────────
const COMTRADE_CODES = {
  IND: 699, USA: 842, GBR: 826, DEU: 276, NLD: 528,
  AUS: 36,  CAN: 124, FRA: 251, JPN: 392, ARE: 784,
  SAU: 682, SGP: 702, CHN: 156, VNM: 704, IDN: 360,
  THA: 764,
};

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 1: DB STATUS CHECK
// ═══════════════════════════════════════════════════════════════════════
async function showStatus() {
  console.log('\n📊 DB Status — trade_statistics table\n');

  const total = await pool.query('SELECT COUNT(*) as total FROM trade_statistics');
  console.log(`  Total records: ${total.rows[0].total}`);

  const bySource = await pool.query(`
    SELECT data_source, COUNT(*) as count
    FROM trade_statistics
    GROUP BY data_source
    ORDER BY count DESC
  `);
  console.log('\n  By source:');
  bySource.rows.forEach(r => console.log(`    ${r.data_source}: ${r.count}`));

  const byHS = await pool.query(`
    SELECT hs_code, COUNT(*) as count,
           STRING_AGG(DISTINCT reporter_country, ', ' ORDER BY reporter_country) as reporters
    FROM trade_statistics
    WHERE hs_code IN ('4419','7323','7013','6911','6912','7615','4602','8215','7418')
    GROUP BY hs_code
    ORDER BY hs_code
  `);
  console.log('\n  By HS Code (your products):');
  byHS.rows.forEach(r => console.log(`    HS ${r.hs_code}: ${r.count} records | reporters: ${r.reporters}`));

  const byYear = await pool.query(`
    SELECT year, COUNT(*) as count
    FROM trade_statistics
    GROUP BY year
    ORDER BY year
  `);
  console.log('\n  By year:');
  byYear.rows.forEach(r => console.log(`    ${r.year}: ${r.count} records`));

  const competitors = await pool.query(`
    SELECT reporter_country, hs_code,
           SUM(trade_value_usd) as total_value,
           SUM(quantity_kg) as total_kg,
           ROUND(SUM(trade_value_usd)::numeric / NULLIF(SUM(quantity_kg), 0), 4) as avg_cif_per_kg
    FROM trade_statistics
    WHERE reporter_country IN ('CHN', 'VNM', 'IDN', 'THA')
      AND hs_code IN ('4419','4420','4602')
      AND quantity_kg > 0
    GROUP BY reporter_country, hs_code
    ORDER BY hs_code, reporter_country
  `);
  if (competitors.rows.length > 0) {
    console.log('\n  Competitor avg CIF (USD/kg) — wood/bamboo only (reliable KG data):');
    competitors.rows.forEach(r => {
      console.log(`    ${r.reporter_country} HS${r.hs_code}: $${parseFloat(r.avg_cif_per_kg).toFixed(3)}/kg CIF (${(parseFloat(r.total_value)/1000000).toFixed(1)}M USD, ${(parseFloat(r.total_kg)/1000).toFixed(0)}K kg)`);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 2: CENSUS BUREAU FETCH
// ═══════════════════════════════════════════════════════════════════════
async function fetchCensus() {
  const API_KEY = process.env.CENSUS_API_KEY;
  if (!API_KEY) {
    console.error('❌ CENSUS_API_KEY not set in scraping/.env');
    return;
  }

  console.log('\n🏛️  Census Bureau — Fetching USA Import Data\n');

  const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  let totalInserted = 0;
  let totalFetched = 0;

  for (const hsCode of HS_CODES_4DIGIT) {
    console.log(`\n  📦 HS ${hsCode}...`);

    for (const year of YEARS) {
      let yearRecords = [];

      for (const month of MONTHS) {
        const time = `${year}-${String(month).padStart(2, '0')}`;

        try {
          const url = `https://api.census.gov/data/timeseries/intltrade/imports/hs?get=CTY_CODE,CTY_NAME,GEN_VAL_MO,GEN_QY1_MO,MONTH,YEAR&I_COMMODITY=${hsCode}&time=${time}&key=${API_KEY}`;

          const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

          if (!res.ok) {
            if (res.status === 400) break; // No data for this period
            console.warn(`    ⚠️  ${time}: HTTP ${res.status}`);
            await sleep(2000);
            continue;
          }

          const data = await res.json();
          if (!Array.isArray(data) || data.length < 2) continue;

          const [headers, ...rows] = data;
          const records = rows
            .map(row => {
              const r = {};
              headers.forEach((h, i) => r[h] = row[i]);
              return r;
            })
            .filter(r => parseFloat(r.GEN_VAL_MO) > 0)
            .map(r => ({
              reporter_country: 'USA',
              partner_country: CENSUS_TO_ISO3[r.CTY_CODE] || null,
              hs_code: hsCode,
              flow: 'import',
              year: parseInt(r.YEAR),
              month: parseInt(r.MONTH),
              trade_value_usd: Math.round(parseFloat(r.GEN_VAL_MO)),
              // NOTE: GEN_QY1_MO unit varies by HS code — KG for wood, could be pieces/dozen for others
              quantity_raw: Math.round(parseFloat(r.GEN_QY1_MO) || 0),
              data_source: 'census_bureau',
            }))
            .filter(r => r.partner_country); // sirf known countries

          yearRecords.push(...records);
          totalFetched += records.length;

          await sleep(300); // Rate limit respect
        } catch (err) {
          console.warn(`    ⚠️  ${time}: ${err.message.substring(0, 50)}`);
          await sleep(2000);
        }
      }

      // ── Monthly store directly ──
      const WOOD_HS = ['4419', '4420', '4602'];
      for (const rec of yearRecords) {
        try {
          const isWood = WOOD_HS.includes(rec.hs_code);
          const quantityKg = isWood ? rec.quantity_raw : null;
          const avgPrice = (isWood && rec.quantity_raw > 0)
            ? rec.trade_value_usd / rec.quantity_raw
            : null;

          await pool.query(`
            INSERT INTO trade_statistics
              (reporter_country, partner_country, hs_code, year, month, flow,
               trade_value_usd, quantity_kg, avg_unit_price, data_source, confidence)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'census_bureau','verified')
            ON CONFLICT (reporter_country, partner_country, hs_code, year, month, flow, data_source)
            DO UPDATE SET
              trade_value_usd = EXCLUDED.trade_value_usd,
              quantity_kg     = EXCLUDED.quantity_kg,
              avg_unit_price  = EXCLUDED.avg_unit_price,
              updated_at      = NOW()
          `, [
            rec.reporter_country, rec.partner_country, rec.hs_code,
            rec.year, rec.month, rec.flow, rec.trade_value_usd, quantityKg, avgPrice
          ]);
          totalInserted++;
        } catch (err) {
          console.warn(`    DB insert failed: ${err.message.substring(0, 60)}`);
        }
      }

      if (yearRecords.length > 0) {
        const countries = [...new Set(yearRecords.map(r => r.partner_country))];
        console.log(`    ${year}: ${yearRecords.length} monthly records | ${countries.slice(0,6).join(', ')}`);
      }

      await sleep(500);
    }
  }

  console.log(`\n  ✅ Census complete: ${totalFetched} monthly → ${totalInserted} yearly records saved`);
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 3: COMTRADE FETCH
// ═══════════════════════════════════════════════════════════════════════
async function fetchCOMTRADE() {
  const API_KEY = process.env.COMTRADE_API_KEY;
  if (!API_KEY) {
    console.error('❌ COMTRADE_API_KEY not set in scraping/.env');
    return;
  }

  console.log('\n🌐 UN COMTRADE — Fetching Trade Data\n');
  console.log('  Rate limit: 100 requests/day — fetching carefully\n');

  const BASE_URL = 'https://comtradeapi.un.org/data/v1/get/C/A/HS';
  const YEARS = ['2020', '2021', '2022', '2023', '2024'];
  let requestCount = 0;
  let totalInserted = 0;

  const fetchComtrade = async (params) => {
    if (requestCount >= 99) {
      console.warn('  ⚠️  Approaching rate limit (99 requests) — stopping COMTRADE');
      return [];
    }

    try {
      const url = new URL(BASE_URL);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

      const res = await fetch(url.toString(), {
        headers: { 'Ocp-Apim-Subscription-Key': API_KEY },
        signal: AbortSignal.timeout(20000),
      });

      requestCount++;

      if (!res.ok) {
        if (res.status === 429) {
          console.warn('  ⚠️  Rate limited — stopping COMTRADE for today');
          return [];
        }
        return [];
      }

      const data = await res.json();
      await sleep(1500); // Respect rate limit
      return data?.data || [];
    } catch (err) {
      console.warn(`  ⚠️  COMTRADE error: ${err.message.substring(0, 60)}`);
      return [];
    }
  };

  // Numeric COMTRADE codes → ISO3
  const COMTRADE_TO_ISO3 = {
    '699':'IND','842':'USA','826':'GBR','276':'DEU','528':'NLD',
    '36':'AUS','124':'CAN','251':'FRA','392':'JPN','784':'ARE',
    '682':'SAU','702':'SGP','156':'CHN','704':'VNM','360':'IDN',
    '764':'THA','608':'PHL','50':'BGD','458':'MYS','586':'PAK',
    '792':'TUR','380':'ITA','724':'ESP','56':'BEL','410':'KOR',
    '756':'CHE','208':'DNK','578':'NOR','752':'SWE','554':'NZL',
  };
  const toISO = (code) => COMTRADE_TO_ISO3[String(code)] || String(code);

  const insertRecord = async (rec) => {
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
  };

  // ── SMART COMTRADE FETCH ──
  // Roz same command: node scripts/fetch-all-data.js --comtrade
  // Script khud DB check karke missing data fetch karegi
  // 95 calls limit mein rukegi — kal se continue karegi

  const FETCH_PLAN = [
    // 9 markets × 11 HS = 99 calls per country (within 100/day limit)
    // Markets selected based on: India's top export destinations + key buyer markets
    { reporter: 'IND', markets: ['USA','GBR','DEU','AUS','ARE','SAU','CAN','JPN','NLD'] },
    { reporter: 'CHN', markets: ['USA','GBR','DEU','AUS','ARE','SAU','CAN','JPN','NLD'] },
    // VNM/IDN/THA removed — COMTRADE data cannot be cross-verified with Census Bureau
  ];
  const PERIOD = '2020,2021,2022,2023,2024';

  // Step 1: DB mein kya already hai check karo
  console.log('  Checking DB for existing records...');
  const { rows: existingRows } = await pool.query(`
    SELECT DISTINCT reporter_country, partner_country, hs_code
    FROM trade_statistics
    WHERE data_source = 'comtrade'
  `);
  const existingSet = new Set(existingRows.map(r => r.reporter_country + ':' + r.partner_country + ':' + r.hs_code));
  console.log(`  DB has ${existingSet.size} existing combinations`);

  // Step 2: Missing combinations calculate karo
  const missing = [];
  for (const plan of FETCH_PLAN) {
    for (const market of plan.markets) {
      for (const hsCode of HS_CODES_4DIGIT) {
        const key = plan.reporter + ':' + market + ':' + hsCode;
        if (!existingSet.has(key)) {
          missing.push({ reporter: plan.reporter, market, hsCode });
        }
      }
    }
  }
  console.log(`  Missing combinations: ${missing.length} (will fetch up to 95 today)`);

  // Step 3: Missing fetch karo — 95 limit mein
  let fetched = 0;
  outerLoop: for (const item of missing) {
    if (requestCount >= 99) {
      console.log(`  Rate limit reached — ${missing.length - fetched} combinations remaining for tomorrow`);
      break outerLoop;
    }
    const records = await fetchComtrade({
      cmdCode: item.hsCode,
      reporterCode: COMTRADE_CODES[item.reporter],
      partnerCode: COMTRADE_CODES[item.market],
      flowCode: 'X',
      period: PERIOD,
      maxRecords: 500,
      format: 'JSON',
      includeDesc: true,
    });
    for (const rec of records) await insertRecord(rec);
    if (records.length > 0) {
      console.log(`    ${item.reporter}->${item.market} HS${item.hsCode}: ${records.length} records`);
    }
    fetched++;
    await sleep(300);
  }

  if (missing.length === 0) {
    console.log('  All combinations already in DB!');
  }

  console.log('  COMTRADE complete: ' + requestCount + ' API calls, ' + totalInserted + ' records saved');
}
// ═══════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  console.log('BuyerIQ — Complete Data Fetch');
  console.log(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST');
  try {
    await pool.query('SELECT 1');
    console.log('Database connected');
    if (RUN_STATUS) { await showStatus(); await pool.end(); return; }
    if (RUN_CENSUS)   await fetchCensus();
    if (RUN_COMTRADE) await fetchCOMTRADE();
    if (RUN_FOB)      await calculateCompetitorUnitValues();
    const final = await pool.query('SELECT COUNT(*) as total FROM trade_statistics');
    console.log('Done! Total DB records: ' + final.rows[0].total);
  } catch (err) {
    console.error('Fatal error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
