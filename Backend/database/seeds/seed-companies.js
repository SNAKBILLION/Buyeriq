import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const COMPANIES = [
  // US Buyers
  { name: "TJX Companies", slug: "tjx", country: "US", hq: "Framingham, MA, USA", website: "tjx.com", stock: "TJX", exchange: "NYSE", revenue: "$56.4B", revenue_usd: 56400000000, year: 2024, source: "SEC 10-K FY2024", public: true, employees: "340,000+", founded: 1956 },
  { name: "Wayfair", slug: "wayfair", country: "US", hq: "Boston, MA, USA", website: "wayfair.com", stock: "W", exchange: "NYSE", revenue: "$12.0B", revenue_usd: 12000000000, year: 2024, source: "SEC 10-K FY2024", public: true, employees: "13,000+", founded: 2002 },
  { name: "Target Corporation", slug: "target", country: "US", hq: "Minneapolis, MN, USA", website: "target.com", stock: "TGT", exchange: "NYSE", revenue: "$107.6B", revenue_usd: 107600000000, year: 2024, source: "SEC 10-K FY2024", public: true, employees: "440,000+", founded: 1962 },
  { name: "Williams-Sonoma", slug: "williams-sonoma", country: "US", hq: "San Francisco, CA, USA", website: "williams-sonomainc.com", stock: "WSM", exchange: "NYSE", revenue: "$7.7B", revenue_usd: 7700000000, year: 2024, source: "SEC 10-K FY2024", public: true, employees: "20,000+", founded: 1956 },
  { name: "Amazon Home", slug: "amazon", country: "US", hq: "Seattle, WA, USA", website: "amazon.com", stock: "AMZN", exchange: "NASDAQ", revenue: "$574B", revenue_usd: 574000000000, year: 2024, source: "SEC 10-K FY2024", public: true, employees: "1,525,000+", founded: 1994 },
  { name: "Kirkland's Inc.", slug: "kirklands", country: "US", hq: "Nashville, TN, USA", website: "kirklands.com", stock: "KIRK", exchange: "NASDAQ", revenue: "$490M", revenue_usd: 490000000, year: 2024, source: "SEC 10-K FY2024", public: true, employees: "4,000+", founded: 1966 },
  { name: "World Market", slug: "world-market", country: "US", hq: "Alameda, CA, USA", website: "worldmarket.com", stock: null, exchange: null, revenue: "$1.2B est.", revenue_usd: 1200000000, year: 2024, source: "Industry estimate", public: false, employees: "10,000+", founded: 1958 },
  { name: "Crate & Barrel", slug: "crate-barrel", country: "US", hq: "Northbrook, IL, USA", website: "crateandbarrel.com", stock: null, exchange: null, revenue: "$1.5B est.", revenue_usd: 1500000000, year: 2024, source: "Industry estimate (Euromarket Designs)", public: false, employees: "7,000+", founded: 1962 },
  { name: "Ross Stores", slug: "ross-stores", country: "US", hq: "Dublin, CA, USA", website: "rossstores.com", stock: "ROST", exchange: "NASDAQ", revenue: "$20.4B", revenue_usd: 20400000000, year: 2024, source: "SEC 10-K FY2024", public: true, employees: "110,000+", founded: 1982 },
  { name: "At Home Group", slug: "at-home", country: "US", hq: "Plano, TX, USA", website: "athome.com", stock: null, exchange: null, revenue: "$1.4B est.", revenue_usd: 1400000000, year: 2024, source: "Industry estimate (Hellman & Friedman)", public: false, employees: "6,000+", founded: 2011 },
  { name: "Hobby Lobby", slug: "hobby-lobby", country: "US", hq: "Oklahoma City, OK, USA", website: "hobbylobby.com", stock: null, exchange: null, revenue: "$7.7B est.", revenue_usd: 7700000000, year: 2024, source: "Forbes est.", public: false, employees: "43,000+", founded: 1972 },
  { name: "Burlington Stores", slug: "burlington", country: "US", hq: "Burlington, NJ, USA", website: "burlington.com", stock: "BURL", exchange: "NYSE", revenue: "$9.7B", revenue_usd: 9700000000, year: 2024, source: "SEC 10-K FY2024", public: true, employees: "45,000+", founded: 1972 },
  // UK Buyers
  { name: "Dunelm", slug: "dunelm", country: "GB", hq: "Syston, Leicestershire, UK", website: "dunelm.com", stock: "DNLM", exchange: "LSE", revenue: "£1.7B", revenue_usd: 2100000000, year: 2024, source: "Annual Report FY2024", public: true, employees: "11,000+", founded: 1979 },
  { name: "Next Home", slug: "next-home", country: "GB", hq: "Enderby, Leicester, UK", website: "next.co.uk", stock: "NXT", exchange: "LSE", revenue: "£5.5B", revenue_usd: 6900000000, year: 2024, source: "Annual Report FY2024", public: true, employees: "44,000+", founded: 1864 },
  { name: "John Lewis & Partners", slug: "john-lewis", country: "GB", hq: "London, UK", website: "johnlewis.com", stock: null, exchange: null, revenue: "£10.8B", revenue_usd: 13500000000, year: 2024, source: "Partnership Report", public: false, employees: "74,000+", founded: 1864 },
  { name: "TK Maxx / Homesense EU", slug: "tk-maxx", country: "GB", hq: "Watford, UK (TJX Europe)", website: "tkmaxx.com", stock: "TJX", exchange: "NYSE", revenue: "£5.5B est. (TJX Intl)", revenue_usd: 6900000000, year: 2024, source: "TJX 10-K (International segment)", public: true, employees: "60,000+", founded: 1994 },
  // Europe
  { name: "Primark Home", slug: "primark", country: "IE", hq: "Dublin, Ireland", website: "primark.com", stock: "ABF", exchange: "LSE", revenue: "€9B", revenue_usd: 9800000000, year: 2024, source: "ABF Annual Report", public: true, employees: "70,000+", founded: 1969 },
  { name: "IKEA (Inter IKEA)", slug: "ikea", country: "SE", hq: "Delft, Netherlands", website: "ikea.com", stock: null, exchange: null, revenue: "€47.6B", revenue_usd: 51800000000, year: 2024, source: "IKEA Yearly Summary FY23", public: false, employees: "231,000+", founded: 1943 },
  { name: "Tchibo", slug: "tchibo", country: "DE", hq: "Hamburg, Germany", website: "tchibo.de", stock: null, exchange: null, revenue: "€3.1B est.", revenue_usd: 3400000000, year: 2024, source: "Industry estimate", public: false, employees: "12,000+", founded: 1949 },
  { name: "Maisons du Monde", slug: "maisons", country: "FR", hq: "Nantes, France", website: "maisonsdumonde.com", stock: "MDM", exchange: "Euronext", revenue: "€1.2B", revenue_usd: 1300000000, year: 2024, source: "Annual Report", public: true, employees: "8,500+", founded: 1996 },
  { name: "JYSK", slug: "jysk", country: "DK", hq: "Brabrand, Denmark", website: "jysk.com", stock: null, exchange: null, revenue: "€5.6B", revenue_usd: 6100000000, year: 2024, source: "Annual Report FY23/24", public: false, employees: "33,000+", founded: 1979 },
  { name: "H&M Home", slug: "hm-home", country: "SE", hq: "Stockholm, Sweden", website: "hm.com/home", stock: "HM-B", exchange: "OMX", revenue: "SEK 236B (group)", revenue_usd: 22500000000, year: 2024, source: "H&M Group Annual Report", public: true, employees: "143,000+", founded: 1947 },
  { name: "Zara Home", slug: "zara-home", country: "ES", hq: "Arteixo, Spain (Inditex)", website: "zarahome.com", stock: "ITX", exchange: "BME", revenue: "€36B (Inditex group)", revenue_usd: 39200000000, year: 2024, source: "Inditex Annual Report", public: true, employees: "165,000+", founded: 2003 },
  { name: "Action", slug: "action", country: "NL", hq: "Zwaagdijk, Netherlands", website: "action.com", stock: null, exchange: null, revenue: "€11.3B", revenue_usd: 12300000000, year: 2024, source: "Annual Report FY2023", public: false, employees: "75,000+", founded: 1993 },
  { name: "Flying Tiger Copenhagen", slug: "flying-tiger", country: "DK", hq: "Copenhagen, Denmark", website: "flyingtiger.com", stock: null, exchange: null, revenue: "€900M est.", revenue_usd: 980000000, year: 2024, source: "Industry estimate", public: false, employees: "6,000+", founded: 1995 },
  { name: "Søstrene Grene", slug: "sostrene-grene", country: "DK", hq: "Aarhus, Denmark", website: "sostrenegrene.com", stock: null, exchange: null, revenue: "€500M est.", revenue_usd: 545000000, year: 2024, source: "Industry estimate", public: false, employees: "3,000+", founded: 1973 },
  // North America (non-US)
  { name: "Canadian Tire", slug: "canadian-tire", country: "CA", hq: "Toronto, ON, Canada", website: "canadiantire.ca", stock: "CTC.A", exchange: "TSX", revenue: "C$17.8B", revenue_usd: 13200000000, year: 2024, source: "Annual Report FY2023", public: true, employees: "58,000+", founded: 1922 },
  // Asia-Pacific
  { name: "Kmart Australia", slug: "kmart-au", country: "AU", hq: "Melbourne, VIC, Australia", website: "kmart.com.au", stock: "WES", exchange: "ASX", revenue: "A$10.8B (Kmart Group)", revenue_usd: 7100000000, year: 2024, source: "Wesfarmers Annual Report", public: true, employees: "50,000+", founded: 1969 },
  { name: "Muji (Ryohin Keikaku)", slug: "muji", country: "JP", hq: "Tokyo, Japan", website: "muji.com", stock: "7453", exchange: "TSE", revenue: "¥580B", revenue_usd: 3900000000, year: 2024, source: "Annual Report FY2024", public: true, employees: "19,000+", founded: 1980 },
  { name: "Nitori Holdings", slug: "nitori", country: "JP", hq: "Sapporo, Japan", website: "nitori.co.jp", stock: "9843", exchange: "TSE", revenue: "¥948B", revenue_usd: 6400000000, year: 2024, source: "Annual Report FY2024", public: true, employees: "46,000+", founded: 1967 },
  // Africa
  { name: "Woolworths SA", slug: "woolworths-sa", country: "ZA", hq: "Cape Town, South Africa", website: "woolworths.co.za", stock: "WHL", exchange: "JSE", revenue: "ZAR 87B", revenue_usd: 4700000000, year: 2024, source: "Annual Report FY2024", public: true, employees: "46,000+", founded: 1931 },
];

async function main() {
  console.log("Seeding companies + linking to buyers...\n");
  let count = 0;

  for (const c of COMPANIES) {
    try {
      // Check if company already exists
      const existing = await pool.query("SELECT id FROM companies WHERE name = $1 LIMIT 1", [c.name]);
      let companyId;

      if (existing.rows.length > 0) {
        companyId = existing.rows[0].id;
        // Update existing
        await pool.query(`
          UPDATE companies SET
            hq_address = $1, website = $2, stock_ticker = $3, stock_exchange = $4,
            revenue = $5, revenue_usd = $6, revenue_year = $7, revenue_source = $8,
            revenue_conf = $9::confidence_level, employee_count = $10, founded_year = $11, is_public = $12
          WHERE id = $13
        `, [c.hq, c.website, c.stock, c.exchange, c.revenue, c.revenue_usd, c.year,
            c.source, c.public ? 'verified' : 'industry_estimate', c.employees, c.founded, c.public, companyId]);
      } else {
        // Insert new
        const res = await pool.query(`
          INSERT INTO companies (
            name, country_code, hq_address, website,
            stock_ticker, stock_exchange, revenue, revenue_usd, revenue_year,
            revenue_source, revenue_conf, employee_count, founded_year, is_public
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::confidence_level,$12,$13,$14)
          RETURNING id
        `, [c.name, c.country, c.hq, c.website, c.stock, c.exchange, c.revenue, c.revenue_usd, c.year,
            c.source, c.public ? 'verified' : 'industry_estimate', c.employees, c.founded, c.public]);
        companyId = res.rows[0]?.id;
      }

      if (companyId && c.slug) {
        await pool.query("UPDATE buyers SET company_id = $1 WHERE slug = $2", [companyId, c.slug]);
      }

      count++;
      console.log(`  ✅ ${c.name} → ${c.stock || 'private'} → $${(c.revenue_usd / 1e9).toFixed(1)}B`);
    } catch (err) {
      console.error(`  ✗ ${c.name}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${count}/${COMPANIES.length} companies seeded and linked to buyers`);
  await pool.end();
}

main();
