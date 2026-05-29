import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const BUYERS = [
  { slug: "tjx", name: "TJX Companies", tier: "mega_volume", country_code: "US", region: "North America", stores_count: "5,000+", wood_preferences: ["Acacia","Mango","Sheesham"], finish_preferences: ["Natural Oil","Dark Walnut","Honey"], top_products: ["Chopping Boards","Serving Trays","Cheese Boards"], fob_min: 5.5, fob_max: 14, fob_sweet_spot: "$7.99–$12.99 FOB", retail_multiple: "3.5–4x", seasonal_q1: 30, seasonal_q2: 15, seasonal_q3: 20, seasonal_q4: 35, lead_time: "90–120 days", moq: "2,000–5,000 pcs/SKU", payment_terms: "Net 60" },
  { slug: "wayfair", name: "Wayfair", tier: "mega_volume", country_code: "US", region: "North America", stores_count: "Online", wood_preferences: ["Acacia","Mango","Teak","Bamboo"], finish_preferences: ["Natural","Walnut","Honey"], top_products: ["Cutting Boards","Serving Trays","Kitchen Islands"], fob_min: 6, fob_max: 18, fob_sweet_spot: "$8–$15 FOB", retail_multiple: "3–4x", seasonal_q1: 25, seasonal_q2: 20, seasonal_q3: 20, seasonal_q4: 35, lead_time: "90–120 days", moq: "500–2,000 pcs", payment_terms: "Net 30-45" },
  { slug: "target", name: "Target Corporation", tier: "mega_volume", country_code: "US", region: "North America", stores_count: "1,956", wood_preferences: ["Acacia","Mango","Rubberwood","Bamboo"], finish_preferences: ["Natural Oil","Light Wash"], top_products: ["Cutting Boards","Serving Trays","Kitchen Storage"], fob_min: 4, fob_max: 12, fob_sweet_spot: "$5.99–$9.99 FOB", retail_multiple: "3.5–5x", seasonal_q1: 25, seasonal_q2: 20, seasonal_q3: 20, seasonal_q4: 35, lead_time: "120–150 days", moq: "5,000–20,000 pcs", payment_terms: "Net 60" },
  { slug: "williams-sonoma", name: "Williams-Sonoma", tier: "premium", country_code: "US", region: "North America", stores_count: "500+", wood_preferences: ["Acacia","Teak","Olivewood","Walnut"], finish_preferences: ["Premium Oil","Food-safe","Hand-rubbed"], top_products: ["Premium Cutting Boards","Artisan Cheese Boards","Serving Platters"], fob_min: 12, fob_max: 50, fob_sweet_spot: "$18–$35 FOB", retail_multiple: "2.5–3x", seasonal_q1: 20, seasonal_q2: 20, seasonal_q3: 25, seasonal_q4: 35, lead_time: "120–180 days", moq: "500–1,500 pcs", payment_terms: "Net 45" },
  { slug: "amazon", name: "Amazon Home", tier: "mega_volume", country_code: "US", region: "North America", stores_count: "Online", wood_preferences: ["Bamboo","Acacia","Teak","Mango"], finish_preferences: ["Natural","Modern Clean"], top_products: ["Cutting Boards","Kitchen Organizers","Utensil Sets"], fob_min: 3, fob_max: 15, fob_sweet_spot: "$4–$10 FOB", retail_multiple: "3–5x", seasonal_q1: 20, seasonal_q2: 20, seasonal_q3: 25, seasonal_q4: 35, lead_time: "60–90 days", moq: "1,000–5,000 pcs", payment_terms: "Net 30" },
  { slug: "kirklands", name: "Kirkland's Inc.", tier: "mid_range", country_code: "US", region: "North America", stores_count: "330+", wood_preferences: ["Mango","Acacia","Reclaimed"], finish_preferences: ["Distressed","Farmhouse White"], top_products: ["Decorative Trays","Serving Boards","Farmhouse Decor"], fob_min: 5, fob_max: 16, fob_sweet_spot: "$7–$13 FOB", retail_multiple: "3–4x", seasonal_q1: 15, seasonal_q2: 20, seasonal_q3: 25, seasonal_q4: 40, lead_time: "90–120 days", moq: "1,000–3,000 pcs", payment_terms: "Net 30-45" },
  { slug: "world-market", name: "World Market", tier: "mid_range", country_code: "US", region: "North America", stores_count: "240+", wood_preferences: ["Mango","Acacia","Olivewood","Teak"], finish_preferences: ["Natural","Artisan","Global Craft"], top_products: ["Serving Boards","Cheese Boards","Global Kitchen"], fob_min: 6, fob_max: 20, fob_sweet_spot: "$8–$16 FOB", retail_multiple: "3–3.5x", seasonal_q1: 20, seasonal_q2: 20, seasonal_q3: 25, seasonal_q4: 35, lead_time: "90–120 days", moq: "500–2,000 pcs", payment_terms: "Net 30-45" },
  { slug: "crate-barrel", name: "Crate & Barrel", tier: "premium", country_code: "US", region: "North America", stores_count: "100+", wood_preferences: ["Acacia","Teak","Olivewood","Walnut"], finish_preferences: ["Natural Oil","Food-safe","Raw Edge"], top_products: ["Cutting Boards","Serving Boards","Wine Racks"], fob_min: 12, fob_max: 40, fob_sweet_spot: "$15–$30 FOB", retail_multiple: "2.5–3.5x", seasonal_q1: 20, seasonal_q2: 20, seasonal_q3: 25, seasonal_q4: 35, lead_time: "120–150 days", moq: "500–2,000 pcs", payment_terms: "Net 45" },
  { slug: "ross-stores", name: "Ross Stores", tier: "value", country_code: "US", region: "North America", stores_count: "2,100+", wood_preferences: ["Acacia","Mango","Bamboo"], finish_preferences: ["Natural","Dark Stain","Rustic"], top_products: ["Cutting Boards","Serving Trays","Kitchen Decor"], fob_min: 4, fob_max: 12, fob_sweet_spot: "$5–$10 FOB", retail_multiple: "3–4x", seasonal_q1: 25, seasonal_q2: 20, seasonal_q3: 20, seasonal_q4: 35, lead_time: "90–120 days", moq: "2,000–5,000 pcs", payment_terms: "Net 60" },
  { slug: "at-home", name: "At Home Group", tier: "mid_range", country_code: "US", region: "North America", stores_count: "250+", wood_preferences: ["Mango","Acacia","Reclaimed"], finish_preferences: ["Distressed","Farmhouse","Whitewash"], top_products: ["Decorative Trays","Serving Boards","Kitchen Decor"], fob_min: 5, fob_max: 18, fob_sweet_spot: "$7–$14 FOB", retail_multiple: "3–4x", seasonal_q1: 15, seasonal_q2: 20, seasonal_q3: 25, seasonal_q4: 40, lead_time: "90–120 days", moq: "1,000–3,000 pcs", payment_terms: "Net 45" },
  { slug: "hobby-lobby", name: "Hobby Lobby", tier: "mid_range", country_code: "US", region: "North America", stores_count: "960+", wood_preferences: ["Mango","Acacia","Reclaimed","Pine"], finish_preferences: ["Distressed White","Rustic","Farmhouse Grey"], top_products: ["Decorative Wood","Farmhouse Signs","Serving Boards"], fob_min: 4, fob_max: 16, fob_sweet_spot: "$6–$12 FOB", retail_multiple: "3.5–4.5x", seasonal_q1: 20, seasonal_q2: 20, seasonal_q3: 25, seasonal_q4: 35, lead_time: "90–120 days", moq: "2,000–5,000 pcs", payment_terms: "Net 30-45" },
  { slug: "burlington", name: "Burlington Stores", tier: "value", country_code: "US", region: "North America", stores_count: "1,000+", wood_preferences: ["Acacia","Bamboo","Mango"], finish_preferences: ["Natural","Rustic","Dark Stain"], top_products: ["Cutting Boards","Serving Trays","Kitchen Decor"], fob_min: 4, fob_max: 12, fob_sweet_spot: "$5–$9 FOB", retail_multiple: "3.5–4x", seasonal_q1: 25, seasonal_q2: 20, seasonal_q3: 20, seasonal_q4: 35, lead_time: "90–120 days", moq: "2,000–5,000 pcs", payment_terms: "Net 60" },
  { slug: "dunelm", name: "Dunelm", tier: "mid_range", country_code: "GB", region: "Europe", stores_count: "180+", wood_preferences: ["Acacia","Mango","Bamboo"], finish_preferences: ["Natural","Light","Modern"], top_products: ["Chopping Boards","Serving Trays","Kitchen Storage"], fob_min: 5, fob_max: 14, fob_sweet_spot: "£6–£12 FOB", retail_multiple: "3–3.5x", seasonal_q1: 20, seasonal_q2: 20, seasonal_q3: 25, seasonal_q4: 35, lead_time: "100–140 days", moq: "2,000–5,000 pcs", payment_terms: "Net 45" },
  { slug: "next-home", name: "Next Home", tier: "mid_range", country_code: "GB", region: "Europe", stores_count: "500+", wood_preferences: ["Acacia","Mango","Oak-look"], finish_preferences: ["Natural","Modern Grey","Blonde"], top_products: ["Chopping Boards","Serving Boards","Kitchen Accessories"], fob_min: 5, fob_max: 15, fob_sweet_spot: "£6–£12 FOB", retail_multiple: "3–4x", seasonal_q1: 20, seasonal_q2: 20, seasonal_q3: 25, seasonal_q4: 35, lead_time: "120–150 days", moq: "2,000–5,000 pcs", payment_terms: "Net 45" },
  { slug: "john-lewis", name: "John Lewis & Partners", tier: "premium", country_code: "GB", region: "Europe", stores_count: "34", wood_preferences: ["Acacia","Mango","Olive Wood"], finish_preferences: ["Natural Oil","Food-safe","Artisan"], top_products: ["Chopping Boards","Serving Boards","Kitchen Storage"], fob_min: 8, fob_max: 22, fob_sweet_spot: "£10–£20 FOB", retail_multiple: "3–3.5x", seasonal_q1: 20, seasonal_q2: 20, seasonal_q3: 25, seasonal_q4: 35, lead_time: "100–140 days", moq: "1,000–3,000 pcs", payment_terms: "Net 45" },
  { slug: "tk-maxx", name: "TK Maxx / Homesense EU", tier: "mega_volume", country_code: "GB", region: "Europe", stores_count: "900+", wood_preferences: ["Acacia","Mango","Sheesham","Olive Wood"], finish_preferences: ["Natural Oil","Dark Stain","Artisan"], top_products: ["Chopping Boards","Serving Boards","Cheese Boards"], fob_min: 5, fob_max: 16, fob_sweet_spot: "£6–£14 FOB", retail_multiple: "3–4x", seasonal_q1: 25, seasonal_q2: 20, seasonal_q3: 20, seasonal_q4: 35, lead_time: "90–120 days", moq: "2,000–5,000 pcs", payment_terms: "Net 60" },
  { slug: "primark", name: "Primark Home", tier: "value", country_code: "IE", region: "Europe", stores_count: "400+", wood_preferences: ["Bamboo","Rubberwood","Acacia"], finish_preferences: ["Natural","Light Blonde"], top_products: ["Cutting Boards","Kitchen Utensils","Storage"], fob_min: 2, fob_max: 8, fob_sweet_spot: "£2–£6 FOB", retail_multiple: "4–6x", seasonal_q1: 25, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 25, lead_time: "120–150 days", moq: "10,000–50,000 pcs", payment_terms: "Net 30" },
  { slug: "ikea", name: "IKEA (Inter IKEA)", tier: "mega_volume", country_code: "SE", region: "Europe", stores_count: "460+", wood_preferences: ["Acacia","Rubberwood","Bamboo","Birch"], finish_preferences: ["Natural Oil","Untreated","Food-safe"], top_products: ["Cutting Boards","Serving Boards","Kitchen Accessories"], fob_min: 2, fob_max: 10, fob_sweet_spot: "$3–$7 FOB", retail_multiple: "4–6x", seasonal_q1: 25, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 25, lead_time: "120–180 days", moq: "10,000–100,000 pcs", payment_terms: "Net 30" },
  { slug: "tchibo", name: "Tchibo", tier: "mid_range", country_code: "DE", region: "Europe", stores_count: "900+", wood_preferences: ["Acacia","Bamboo","Beech"], finish_preferences: ["Natural","Functional"], top_products: ["Cutting Boards","Kitchen Utensils","Storage"], fob_min: 4, fob_max: 12, fob_sweet_spot: "€5–€10 FOB", retail_multiple: "3–4x", seasonal_q1: 25, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 25, lead_time: "90–120 days", moq: "5,000–20,000 pcs", payment_terms: "Net 30" },
  { slug: "maisons", name: "Maisons du Monde", tier: "mid_range", country_code: "FR", region: "Europe", stores_count: "350+", wood_preferences: ["Mango","Acacia","Teak","Recycled"], finish_preferences: ["Natural","Bohemian","Mediterranean"], top_products: ["Serving Boards","Kitchen Decor","Cutting Boards"], fob_min: 6, fob_max: 20, fob_sweet_spot: "€8–€16 FOB", retail_multiple: "3–3.5x", seasonal_q1: 20, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 30, lead_time: "100–140 days", moq: "1,000–5,000 pcs", payment_terms: "Net 45" },
  { slug: "jysk", name: "JYSK", tier: "value", country_code: "DK", region: "Europe", stores_count: "3,300+", wood_preferences: ["Acacia","Bamboo","Rubberwood"], finish_preferences: ["Natural","Scandinavian"], top_products: ["Cutting Boards","Kitchen Accessories","Serving Trays"], fob_min: 3, fob_max: 10, fob_sweet_spot: "€3.50–€8 FOB", retail_multiple: "3.5–5x", seasonal_q1: 25, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 25, lead_time: "90–120 days", moq: "5,000–20,000 pcs", payment_terms: "Net 30" },
  { slug: "hm-home", name: "H&M Home", tier: "value", country_code: "SE", region: "Europe", stores_count: "4,000+", wood_preferences: ["Bamboo","Mango","Acacia","Rubberwood"], finish_preferences: ["Natural","Light Wash","Neutral"], top_products: ["Cutting Boards","Serving Trays","Kitchen Storage"], fob_min: 3, fob_max: 15, fob_sweet_spot: "$4–$10 FOB", retail_multiple: "3.5–5x", seasonal_q1: 25, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 25, lead_time: "90–120 days", moq: "5,000–20,000 pcs", payment_terms: "Net 30" },
  { slug: "zara-home", name: "Zara Home", tier: "mid_range", country_code: "ES", region: "Europe", stores_count: "500+", wood_preferences: ["Acacia","Mango","Olivewood","Teak"], finish_preferences: ["Natural","Raw Edge","Mediterranean"], top_products: ["Serving Boards","Kitchen Accessories","Table Decor"], fob_min: 8, fob_max: 25, fob_sweet_spot: "$10–$20 FOB", retail_multiple: "3–4x", seasonal_q1: 20, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 30, lead_time: "60–90 days", moq: "3,000–10,000 pcs", payment_terms: "Net 30" },
  { slug: "action", name: "Action", tier: "value", country_code: "NL", region: "Europe", stores_count: "2,600+", wood_preferences: ["Bamboo","Rubberwood","Pine","Acacia"], finish_preferences: ["Natural","Basic Oil"], top_products: ["Cutting Boards","Utensils","Storage","Coasters"], fob_min: 1, fob_max: 6, fob_sweet_spot: "€1.50–€4 FOB", retail_multiple: "4–6x", seasonal_q1: 25, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 25, lead_time: "90–120 days", moq: "20,000–100,000 pcs", payment_terms: "Net 30" },
  { slug: "flying-tiger", name: "Flying Tiger Copenhagen", tier: "value", country_code: "DK", region: "Europe", stores_count: "800+", wood_preferences: ["Bamboo","Rubberwood","Beech"], finish_preferences: ["Natural","Colourful","Playful"], top_products: ["Kitchen Gadgets","Cutting Boards","Utensils"], fob_min: 1, fob_max: 6, fob_sweet_spot: "€1.50–€4 FOB", retail_multiple: "4–6x", seasonal_q1: 25, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 25, lead_time: "90–120 days", moq: "5,000–20,000 pcs", payment_terms: "Net 30" },
  { slug: "sostrene-grene", name: "Sostrene Grene", tier: "value", country_code: "DK", region: "Europe", stores_count: "300+", wood_preferences: ["Bamboo","Beech","Acacia","Rubberwood"], finish_preferences: ["Natural","Pastel","Scandinavian Soft"], top_products: ["Kitchen Utensils","Cutting Boards","Storage"], fob_min: 2, fob_max: 10, fob_sweet_spot: "€2.50–€7 FOB", retail_multiple: "3.5–5x", seasonal_q1: 25, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 25, lead_time: "90–120 days", moq: "3,000–10,000 pcs", payment_terms: "Net 30" },
  { slug: "canadian-tire", name: "Canadian Tire", tier: "mid_range", country_code: "CA", region: "North America", stores_count: "1,700+", wood_preferences: ["Acacia","Bamboo","Maple-look"], finish_preferences: ["Natural","Canadian Rustic"], top_products: ["Cutting Boards","BBQ Boards","Kitchen Storage"], fob_min: 5, fob_max: 15, fob_sweet_spot: "$6–$12 FOB", retail_multiple: "3–4x", seasonal_q1: 20, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 30, lead_time: "90–120 days", moq: "2,000–5,000 pcs", payment_terms: "Net 45" },
  { slug: "kmart-au", name: "Kmart Australia", tier: "value", country_code: "AU", region: "Asia-Pacific", stores_count: "300+", wood_preferences: ["Acacia","Bamboo","Rubberwood"], finish_preferences: ["Natural","Light","Functional"], top_products: ["Cutting Boards","Kitchen Utensils","Serving Items"], fob_min: 3, fob_max: 10, fob_sweet_spot: "$4–$8 FOB", retail_multiple: "3.5–5x", seasonal_q1: 25, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 25, lead_time: "90–120 days", moq: "5,000–20,000 pcs", payment_terms: "Net 30" },
  { slug: "muji", name: "Muji (Ryohin Keikaku)", tier: "mid_range", country_code: "JP", region: "Asia-Pacific", stores_count: "1,000+", wood_preferences: ["Rubberwood","Bamboo","Oak","Beech"], finish_preferences: ["Natural Untreated","Minimal","Clean"], top_products: ["Kitchen Tools","Cutting Boards","Storage"], fob_min: 4, fob_max: 15, fob_sweet_spot: "$5–$12 FOB", retail_multiple: "3–4x", seasonal_q1: 25, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 25, lead_time: "120–180 days", moq: "3,000–10,000 pcs", payment_terms: "Net 30" },
  { slug: "nitori", name: "Nitori Holdings", tier: "value", country_code: "JP", region: "Asia-Pacific", stores_count: "900+", wood_preferences: ["Rubberwood","Acacia","Bamboo","Pine"], finish_preferences: ["Natural","Light","Functional"], top_products: ["Cutting Boards","Kitchen Storage","Utensil Holders"], fob_min: 3, fob_max: 12, fob_sweet_spot: "$4–$9 FOB", retail_multiple: "3.5–5x", seasonal_q1: 25, seasonal_q2: 25, seasonal_q3: 25, seasonal_q4: 25, lead_time: "120–150 days", moq: "5,000–20,000 pcs", payment_terms: "Net 30" },
  { slug: "woolworths-sa", name: "Woolworths SA", tier: "mid_range", country_code: "ZA", region: "Africa", stores_count: "1,500+", wood_preferences: ["Acacia","Mango","Bamboo"], finish_preferences: ["Natural","Modern African"], top_products: ["Cutting Boards","Serving Boards","Kitchen Accessories"], fob_min: 4, fob_max: 14, fob_sweet_spot: "$5–$10 FOB", retail_multiple: "3–4x", seasonal_q1: 25, seasonal_q2: 20, seasonal_q3: 20, seasonal_q4: 35, lead_time: "90–120 days", moq: "1,000–3,000 pcs", payment_terms: "Net 45" },
];

async function main() {
  console.log("Seeding buyers...");
  let count = 0;
  for (const b of BUYERS) {
    try {
      await pool.query(`
        INSERT INTO buyers (
          slug, name, tier, country_code, region, stores_count,
          wood_preferences, finish_preferences, top_products,
          fob_min, fob_max, fob_sweet_spot, retail_multiple,
          seasonal_q1, seasonal_q2, seasonal_q3, seasonal_q4,
          lead_time, moq, payment_terms,
          brands, design_trends, known_competitors,
          certifications_required, order_windows, negotiation_style,
          score_payment, score_volume, score_margin, score_growth, score_ease,
          data_source, confidence, last_verified
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                  $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33::confidence_level,$34)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          fob_min = EXCLUDED.fob_min,
          fob_max = EXCLUDED.fob_max,
          brands = COALESCE(EXCLUDED.brands, buyers.brands),
          score_payment = COALESCE(EXCLUDED.score_payment, buyers.score_payment),
          score_volume = COALESCE(EXCLUDED.score_volume, buyers.score_volume),
          score_margin = COALESCE(EXCLUDED.score_margin, buyers.score_margin),
          score_growth = COALESCE(EXCLUDED.score_growth, buyers.score_growth),
          score_ease = COALESCE(EXCLUDED.score_ease, buyers.score_ease),
          known_competitors = COALESCE(EXCLUDED.known_competitors, buyers.known_competitors),
          design_trends = COALESCE(EXCLUDED.design_trends, buyers.design_trends),
          negotiation_style = COALESCE(EXCLUDED.negotiation_style, buyers.negotiation_style)
      `, [
        b.slug, b.name, b.tier, b.country_code, b.region, b.stores_count,
        b.wood_preferences, b.finish_preferences, b.top_products,
        b.fob_min, b.fob_max, b.fob_sweet_spot, b.retail_multiple,
        b.seasonal_q1, b.seasonal_q2, b.seasonal_q3, b.seasonal_q4,
        b.lead_time, b.moq, b.payment_terms,
        // New fields with defaults
        b.brands || [],
        b.design_trends || ['Minimalist', 'Natural Finish'],
        b.known_competitors || ['Generic Asian Manufacturer'],
        b.certifications_required || ['FSC'],
        b.order_windows || ['Q1 Jan-Feb', 'Q3 Jul-Aug'],
        b.negotiation_style || 'Standard procurement process',
        b.score_payment || 70, b.score_volume || 70, b.score_margin || 65,
        b.score_growth || 60, b.score_ease || 65,
        'manual_research', 'industry_estimate', new Date().toISOString().split('T')[0],
      ]);
      count++;
      console.log(`  ✅ ${b.name}`);
    } catch (err) {
      console.error(`  ✗ ${b.name}: ${err.message}`);
    }
  }
  console.log(`\nDone: ${count}/${BUYERS.length} buyers inserted`);
  await pool.end();
}

main();
