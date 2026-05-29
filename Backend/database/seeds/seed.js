import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

async function seed() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("Seeding BuyerIQ database...\n");

    // ── Countries ──
    const countries = [
      ["US", "United States", "🇺🇸", "North America", "USD", "3.2% MFN (HS 4419)"],
      ["GB", "United Kingdom", "🇬🇧", "Europe", "GBP", "0% (UK DCTS)"],
      ["DE", "Germany", "🇩🇪", "Europe", "EUR", "0% (EU GSP+)"],
      ["SE", "Sweden", "🇸🇪", "Europe", "SEK", "0% (EU GSP+)"],
      ["AU", "Australia", "🇦🇺", "Asia-Pacific", "AUD", "5% MFN"],
      ["FR", "France", "🇫🇷", "Europe", "EUR", "0% (EU GSP+)"],
      ["DK", "Denmark", "🇩🇰", "Europe", "DKK", "0% (EU GSP+)"],
      ["CA", "Canada", "🇨🇦", "North America", "CAD", "0% MFN"],
      ["NL", "Netherlands", "🇳🇱", "Europe", "EUR", "0% (EU GSP+)"],
      ["ES", "Spain", "🇪🇸", "Europe", "EUR", "0% (EU GSP+)"],
      ["JP", "Japan", "🇯🇵", "Asia-Pacific", "JPY", "0-3.9% MFN"],
      ["ZA", "South Africa", "🇿🇦", "Africa", "ZAR", "Varies"],
      ["IE", "Ireland", "🇮🇪", "Europe", "EUR", "0% (EU GSP+)"],
      ["IN", "India", "🇮🇳", "Asia-Pacific", "INR", "N/A (exporter)"],
      ["CN", "China", "🇨🇳", "Asia-Pacific", "CNY", "N/A (exporter)"],
      ["VN", "Vietnam", "🇻🇳", "Asia-Pacific", "VND", "N/A (exporter)"],
      ["ID", "Indonesia", "🇮🇩", "Asia-Pacific", "IDR", "N/A (exporter)"],
    ];

    for (const [code, name, flag, region, currency, tariff] of countries) {
      await pool.query(
        `INSERT INTO countries (code, name, flag_emoji, region, currency_code, import_tariff_wood)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
        [code, name, flag, region, currency, tariff]
      );
    }
    console.log(`  Countries: ${countries.length} inserted`);

    // ── Compliance Rules ──
    const laws = [
      ["lacey-act-vii", "Lacey Act Phase VII", "US", "2024-12-01", "USDA APHIS", "active", "ALL wood products require species + country declaration at import", "$250-$500,000 per violation"],
      ["eudr", "EU Deforestation Regulation (EUDR)", "EU", "2025-12-30", "EU Member States", "upcoming", "Deforestation-free proof + GPS coordinates required", "Up to 4% of annual EU turnover"],
      ["eutr", "EU Timber Regulation", "EU", "2013-03-03", "EU Member States", "active", "Prohibits illegally harvested timber in EU market", "Criminal prosecution possible"],
      ["iway-6.1", "IKEA IWAY Standard 6.1", "IKEA", "2023-11-01", "IKEA Purchasing", "active", "4-step staircase model. Only FSC accepted, not PEFC", "Loss of IKEA supplier status"],
      ["uk-timber", "UK Timber Regulation", "UK", "2021-01-01", "OPSS", "active", "UK post-Brexit EUTR replacement", "Fines + criminal prosecution"],
      ["prop-65", "California Proposition 65", "US", "1986-01-01", "CA Attorney General", "active", "Warnings for cancer/birth defect chemicals", "$2,500/day per violation"],
      ["ftc-made-usa", "FTC Made in USA Rule", "US", "2021-08-13", "FTC", "active", "Country of origin must be accurate", "$51,744/violation (WSM paid $3.175M Apr 2024)"],
      ["reach", "REACH Chemical Regulation", "EU", "2007-06-01", "ECHA", "active", "Chemical regulation for finishes & treatments", "Market ban + fines"],
      ["au-illegal-logging", "Australian Illegal Logging Prohibition Act", "AU", "2014-11-30", "AU Dept Agriculture", "active", "Prohibits illegally logged timber import", "5 years / AUD $525,000"],
    ];

    for (const [slug, name, scope, date, enforcer, status, summary, penalties] of laws) {
      await pool.query(
        `INSERT INTO compliance_rules (slug, name, country_scope, effective_date, enforcer, status, summary, penalties)
         VALUES ($1,$2,$3,$4,$5,$6::compliance_status,$7,$8) ON CONFLICT (slug) DO NOTHING`,
        [slug, name, scope, date, enforcer, status, summary, penalties]
      );
    }
    console.log(`  Compliance rules: ${laws.length} inserted`);

    // ── Trade Statistics (Verified) ──
    const tradeStats = [
      ["IN", "US", "4419", 2023, "export", 35620000, null, null, "UN COMTRADE"],
      ["IN", "NL", "4419", 2023, "export", 4200000, null, null, "Volza estimate"],
      ["IN", "GB", "4419", 2023, "export", 3500000, null, null, "Volza estimate"],
      ["CN", "US", "4419", 2024, "import", 310000000, 83000000, null, "IndexBox 2024"],
      ["IN", "US", "4419", 2024, "import", 68000000, 18000000, null, "IndexBox 2024"],
      ["VN", "US", "4419", 2024, "import", 21700000, 5800000, null, "IndexBox 2024"],
    ];

    for (const [reporter, partner, hs, year, flow, value, qty, units, source] of tradeStats) {
      await pool.query(
        `INSERT INTO trade_statistics (reporter_country, partner_country, hs_code, year, flow, trade_value_usd, quantity_kg, quantity_units, data_source, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'verified') ON CONFLICT (reporter_country, partner_country, hs_code, year, flow) DO NOTHING`,
        [reporter, partner, hs, year, flow, value, qty, units, source]
      );
    }
    console.log(`  Trade statistics: ${tradeStats.length} inserted`);

    // ── HS Codes (MUST be before products) ──
    // First: chapter-level parent codes
    const hsChapters = [
      ["39", "Plastics and articles thereof", null, 39],
      ["44", "Wood and articles of wood", null, 44],
      ["46", "Vegetable plaiting materials; basketwork", null, 46],
      ["69", "Ceramic products", null, 69],
      ["70", "Glass and glassware", null, 70],
      ["73", "Articles of iron or steel", null, 73],
      ["74", "Copper and articles thereof", null, 74],
      ["76", "Aluminium and articles thereof", null, 76],
      ["82", "Tools, implements, cutlery of base metal", null, 82],
      ["83", "Miscellaneous articles of base metal", null, 83],
    ];
    for (const [code, desc, parent, chapter] of hsChapters) {
      await pool.query(
        `INSERT INTO hs_codes (code, description, parent_code, chapter)
         VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING`,
        [code, desc, parent, chapter]
      );
    }

    // Then: product-level HS codes
    const hsCodes = [
      ["4419", "Tableware and kitchenware, of wood", "44", 44],
      ["441900", "Tableware and kitchenware, of wood (detailed)", "4419", 44],
      ["4420", "Wood marquetry; caskets and cases; other wood articles", "44", 44],
      ["442010", "Statuettes and other ornaments, of wood", "4420", 44],
      ["442090", "Other wood marquetry and inlaid wood, caskets", "4420", 44],
      ["7323", "Table, kitchen or household articles of iron or steel", "73", 73],
      ["7013", "Glassware for table, kitchen or toilet purposes", "70", 70],
      ["6911", "Tableware, kitchenware of porcelain or china", "69", 69],
      ["6912", "Ceramic tableware, kitchenware", "69", 69],
      ["7615", "Table, kitchen or household articles of aluminium", "76", 76],
      ["3924", "Tableware, kitchenware of plastics", "39", 39],
      ["4602", "Basketwork, wickerwork from vegetable materials", "46", 46],
      ["8215", "Spoons, forks, ladles, kitchen tools", "82", 82],
      ["8214", "Cutlery, manicure or pedicure instruments", "82", 82],
      ["7418", "Table, kitchen or household articles of copper", "74", 74],
      ["3926", "Other articles of plastics (silicone tools)", "39", 39],
      ["8302", "Base metal mountings and fittings", "83", 83],
    ];
    for (const [code, desc, parent, chapter] of hsCodes) {
      await pool.query(
        `INSERT INTO hs_codes (code, description, parent_code, chapter)
         VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING`,
        [code, desc, parent, chapter]
      );
    }
    console.log(`  HS codes: ${hsChapters.length} chapters + ${hsCodes.length} product codes inserted`);

    // ── Products ──
    const products = [
      // Wood (HS 4419)
      ["chopping-board", "Chopping Board", "4419", "Cutting Board", 4.5, 12, 0.8, "wood", "12×8×1.5 inch"],
      ["serving-tray", "Serving Tray", "4419", "Serving Tray", 5, 14, 1.2, "wood", "18×12×2 inch"],
      ["salad-bowl", "Salad Bowl Set", "4419", "Bowls", 6, 15, 1.5, "wood", "10×10×4 inch"],
      ["cheese-board", "Cheese Board", "4419", "Cutting Board", 5.5, 13, 0.9, "wood", "14×10×1 inch"],
      ["coaster-set", "Coaster Set (4pc)", "4419", "Coasters", 2, 6, 0.4, "wood", "4×4×0.5 inch"],
      ["wine-rack", "Wine Rack", "4419", "Storage", 8, 22, 2.5, "wood", "18×12×8 inch"],
      ["spice-rack", "Spice Rack", "4419", "Storage", 6, 16, 1.8, "wood", "12×4×10 inch"],
      ["utensil-set", "Utensil Set (5pc)", "4419", "Utensils", 3, 8, 0.5, "wood", "12 inch length"],
      ["cake-stand", "Cake Stand", "4419", "Serving", 7, 18, 1.4, "wood", "12×12×6 inch"],
      ["lazy-susan", "Lazy Susan", "4419", "Serving", 8, 20, 2.0, "wood", "16×16×2 inch"],
      // Steel / Iron (HS 7323)
      ["ss-cookware-set", "Stainless Steel Cookware Set", "7323", "Cookware", 15, 45, 8.0, "steel", "Assorted sizes"],
      ["cast-iron-skillet", "Cast Iron Skillet 12\"", "7323", "Cookware", 8, 18, 3.5, "steel", "12 inch dia"],
      ["ss-mixing-bowls", "SS Mixing Bowl Set (3pc)", "7323", "Bowls", 6, 14, 2.0, "steel", "6/8/10 inch"],
      ["steel-utensil-set", "Steel Kitchen Utensils (6pc)", "7323", "Utensils", 4, 10, 0.8, "steel", "12 inch length"],
      ["iron-kadhai", "Iron Kadhai / Wok", "7323", "Cookware", 5, 12, 2.5, "steel", "12 inch dia"],
      // Glass (HS 7013)
      ["glass-baking-dish", "Glass Baking Dish Set", "7013", "Bakeware", 5, 14, 2.5, "glass", "9×13 inch + 8×8 inch"],
      ["glass-mixing-bowls", "Glass Mixing Bowl Set (4pc)", "7013", "Bowls", 6, 16, 3.0, "glass", "4/6/8/10 inch"],
      ["glass-storage-set", "Glass Storage Container Set", "7013", "Storage", 8, 22, 2.8, "glass", "Assorted sizes"],
      ["glass-serving-bowl", "Glass Serving Bowl", "7013", "Serving", 4, 10, 1.2, "glass", "10 inch dia"],
      // Ceramic / Porcelain (HS 6911)
      ["ceramic-dinner-set", "Ceramic Dinner Set (16pc)", "6911", "Dinnerware", 12, 35, 6.0, "ceramic", "4 each: plates, bowls, mugs, sides"],
      ["porcelain-mug-set", "Porcelain Mug Set (4pc)", "6911", "Drinkware", 3, 8, 1.5, "ceramic", "350ml each"],
      ["stoneware-bowl-set", "Stoneware Bowl Set (4pc)", "6912", "Bowls", 5, 14, 2.0, "ceramic", "6 inch dia each"],
      ["ceramic-baking-dish", "Ceramic Baking Dish", "6912", "Bakeware", 4, 12, 1.8, "ceramic", "9×13 inch"],
      // Aluminum (HS 7615)
      ["aluminum-cookware", "Aluminum Cookware Set (5pc)", "7615", "Cookware", 10, 28, 5.0, "aluminum", "Assorted sizes"],
      ["aluminum-baking-pan", "Aluminum Baking Pan Set", "7615", "Bakeware", 4, 10, 1.5, "aluminum", "9×13 + 8×8 inch"],
      // Bamboo (HS 4602)
      ["bamboo-cutting-board", "Bamboo Cutting Board Set", "4602", "Cutting Board", 3, 9, 0.6, "bamboo", "12×8 + 10×6 inch"],
      ["bamboo-utensil-set", "Bamboo Utensil Set (6pc)", "4602", "Utensils", 2, 6, 0.3, "bamboo", "12 inch length"],
      // Combo / Mixed (HS 8215)
      ["wood-iron-tray", "Wood & Iron Serving Tray", "8215", "Serving", 8, 22, 2.0, "combo_wood_metal", "18×12×3 inch"],
      ["marble-wood-board", "Marble & Wood Cheese Board", "8215", "Cutting Board", 10, 28, 2.5, "combo", "14×10×1 inch"],
      ["wood-metal-utensils", "Wood Handle Metal Utensil Set", "8215", "Utensils", 5, 14, 0.8, "combo_wood_metal", "12 inch length"],
      // Copper (HS 7418)
      ["copper-moscow-mule", "Copper Moscow Mule Mug Set (4pc)", "7418", "Drinkware", 8, 20, 1.6, "copper", "16oz each"],
    ];

    for (const [slug, name, hs, cat, fobMin, fobMax, weight, material, dimensions] of products) {
      await pool.query(
        `INSERT INTO products (slug, name, hs_code, category, fob_range_min, fob_range_max, weight_kg, wood_types, dimensions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (slug) DO UPDATE SET
           dimensions = COALESCE(EXCLUDED.dimensions, products.dimensions),
           wood_types = COALESCE(EXCLUDED.wood_types, products.wood_types)`,
        [slug, name, hs, cat, fobMin, fobMax, weight, material ? [material] : null, dimensions || null]
      );
    }
    console.log(`  Products: ${products.length} inserted`);

    // ── Admin User (always seed a default admin) ──
    const bcrypt = await import("bcryptjs");
    const adminEmail = process.env.SEED_ADMIN_EMAIL || "snaksham7@gmail.com";
    const adminPass = process.env.SEED_ADMIN_PASSWORD || "BuyerIQ@2026";
    const adminName = process.env.SEED_ADMIN_NAME || "Snak";
    const hash = await bcrypt.default.hash(adminPass, 12);
    await pool.query(
      `INSERT INTO users (email, name, role, password_hash) VALUES ($1,$2,'admin',$3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'`,
      [adminEmail, adminName, hash]
    );
    console.log(`  Admin user seeded: ${adminEmail} (role: admin)`);

    console.log("\nSeed complete!");
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
