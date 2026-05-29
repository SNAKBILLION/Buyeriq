// ─────────────────────────────────────────────
// BuyerIQ — Database Inserter
// ─────────────────────────────────────────────
// Final stage of the pipeline: insert cleaned
// records into PostgreSQL with conflict handling.
//
// IMPORTANT: Column names here MUST match the
// schema in Backend/database/migrations/001_initial_schema.sql
// ─────────────────────────────────────────────
import { query, transaction } from '../config/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('db-inserter');

// ── Trade Statistics ─────────────────────────
// Schema: reporter_country, partner_country, hs_code, year, flow (UNIQUE)
//         trade_value_usd, quantity_kg, quantity_units, avg_unit_price,
//         yoy_growth_pct, market_share_pct, data_source, confidence
export async function insertTradeStatistics(records) {
  if (!records.length) return { inserted: 0 };
  let inserted = 0;

  await transaction(async (client) => {
    for (const r of records) {
      const res = await client.query(
        `INSERT INTO trade_statistics
          (reporter_country, partner_country, hs_code, year, flow,
           trade_value_usd, quantity_kg, data_source, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::confidence_level)
         ON CONFLICT (reporter_country, partner_country, hs_code, year, flow)
         DO UPDATE SET
           trade_value_usd = EXCLUDED.trade_value_usd,
           quantity_kg = COALESCE(EXCLUDED.quantity_kg, trade_statistics.quantity_kg),
           data_source = EXCLUDED.data_source
         RETURNING id`,
        [
          r.reporter_country || r.reporter_code,
          r.partner_country || r.partner_code,
          r.hs_code,
          r.year,
          r.flow || r.trade_flow || 'export',
          r.trade_value_usd,
          r.quantity_kg || r.net_weight_kg || null,
          r.data_source || r.source || 'unknown',
          r.confidence || 'verified',
        ]
      );
      inserted += res.rowCount;
    }
  });

  log.info(`Inserted ${inserted} trade statistics records`);
  return { inserted };
}

// ── Shipment Records ─────────────────────────
// Schema: buyer_name_raw, supplier_name_raw, hs_code, product_description,
//         origin_country, origin_port, dest_country, dest_port,
//         ship_date, weight_kg, estimated_value_usd, container_type,
//         data_source, raw_data
export async function insertShipmentRecords(records) {
  if (!records.length) return { inserted: 0 };
  let inserted = 0;

  await transaction(async (client) => {
    for (const r of records) {
      const buyerName = r.buyer_name_raw || r.importer_name || null;
      const supplierName = r.supplier_name_raw || r.exporter_name || null;
      const shipDate = r.ship_date || r.shipment_date || null;

      // Skip records without minimum identifiers
      if (!buyerName && !supplierName) continue;

      const res = await client.query(
        `INSERT INTO shipment_records
          (buyer_name_raw, supplier_name_raw, hs_code, product_description,
           origin_country, origin_port, dest_country, dest_port,
           ship_date, weight_kg, estimated_value_usd, container_type,
           data_source, raw_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (buyer_name_raw, supplier_name_raw, ship_date, hs_code)
           WHERE buyer_name_raw IS NOT NULL AND ship_date IS NOT NULL
         DO UPDATE SET
           weight_kg = COALESCE(EXCLUDED.weight_kg, shipment_records.weight_kg),
           estimated_value_usd = COALESCE(EXCLUDED.estimated_value_usd, shipment_records.estimated_value_usd)
         RETURNING id`,
        [
          buyerName, supplierName,
          r.hs_code || null,
          r.product_description || null,
          r.origin_country || null,
          r.origin_port || null,
          r.dest_country || r.destination_country || null,
          r.dest_port || r.port_of_entry || null,
          shipDate,
          r.weight_kg || null,
          r.estimated_value_usd || r.value_usd || null,
          r.container_type || null,
          r.data_source || r.source || 'importyeti',
          r.raw_data ? JSON.stringify(r.raw_data) : null,
        ]
      );
      inserted += res.rowCount;
    }
  });

  log.info(`Inserted ${inserted} shipment records`);
  return { inserted };
}

// ── Retail Product Data ──────────────────────
// Schema: marketplace, product_url, product_asin, product_title, category,
//         price, currency, rating, review_count, best_seller_rank,
//         brand, seller, material, wood_type, image_url,
//         scraped_at, raw_data
export async function insertRetailProducts(records) {
  if (!records.length) return { inserted: 0 };
  let inserted = 0;

  await transaction(async (client) => {
    for (const r of records) {
      const marketplace = r.marketplace || r.platform || 'unknown';
      const title = r.product_title || r.product_name || r.title || null;

      if (!title) continue;

      const asin = r.product_asin || r.asin || null;
      const productUrl = r.product_url || r.url || null;
      const conflictClause = asin
        ? 'ON CONFLICT (marketplace, product_asin) WHERE product_asin IS NOT NULL'
        : 'ON CONFLICT DO NOTHING';

      const res = await client.query(
        `INSERT INTO retail_product_data
          (marketplace, product_url, product_asin, product_title, category,
           price, currency, rating, review_count, best_seller_rank,
           brand, seller, material, image_url,
           scraped_at, raw_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ${conflictClause}
         ${asin ? `DO UPDATE SET
           price = EXCLUDED.price,
           rating = EXCLUDED.rating,
           review_count = EXCLUDED.review_count,
           best_seller_rank = EXCLUDED.best_seller_rank,
           brand = COALESCE(EXCLUDED.brand, retail_product_data.brand),
           seller = COALESCE(EXCLUDED.seller, retail_product_data.seller),
           material = COALESCE(EXCLUDED.material, retail_product_data.material),
           scraped_at = EXCLUDED.scraped_at` : ''}
         RETURNING id`,
        [
          marketplace,
          r.product_url || r.url || null,
          r.product_asin || r.asin || null,
          title,
          r.category || null,
          r.price || null,
          r.currency || 'USD',
          r.rating || null,
          r.review_count || null,
          r.best_seller_rank || r.bsr_rank || null,
          r.brand || null,
          r.seller || r.seller_name || null,
          r.material || null,
          r.image_url || null,
          r.scraped_at || new Date().toISOString(),
          r.raw_data ? JSON.stringify(r.raw_data) : null,
        ]
      );
      inserted += res.rowCount;
    }
  });

  log.info(`Inserted ${inserted} retail product records`);
  return { inserted };
}

// ── Suppliers ────────────────────────────────
// Schema: name, country_code, cluster, city, product_categories,
//         certifications, source_platform, source_url, confidence
export async function insertSuppliers(records) {
  if (!records.length) return { inserted: 0 };
  let inserted = 0;

  await transaction(async (client) => {
    for (const r of records) {
      const name = r.name || r.company_name || null;
      if (!name) continue;

      const countryCode = r.country_code || r.country || null;

      // Check for existing supplier by name + country to avoid duplicates
      const existing = await client.query(
        `SELECT id FROM suppliers WHERE name = $1 AND country_code = $2 LIMIT 1`,
        [name, countryCode]
      );

      if (existing.rows.length > 0) {
        // Update existing
        await client.query(
          `UPDATE suppliers SET
             product_categories = COALESCE($1, product_categories),
             certifications = COALESCE($2, certifications),
             source_url = COALESCE($3, source_url),
             updated_at = NOW()
           WHERE id = $4`,
          [
            r.product_categories ? (Array.isArray(r.product_categories) ? `{${r.product_categories.join(',')}}` : r.product_categories) : null,
            r.certifications ? (Array.isArray(r.certifications) ? `{${r.certifications.join(',')}}` : r.certifications) : null,
            r.source_url || null,
            existing.rows[0].id,
          ]
        );
        inserted++;
      } else {
        // Insert new
        const res = await client.query(
          `INSERT INTO suppliers
            (name, country_code, cluster, city, product_categories,
             certifications, source_platform, source_url, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::confidence_level)
           RETURNING id`,
          [
            name, countryCode,
            r.cluster || r.region || null,
            r.city || null,
            r.product_categories ? (Array.isArray(r.product_categories) ? `{${r.product_categories.join(',')}}` : r.product_categories) : null,
            r.certifications ? (Array.isArray(r.certifications) ? `{${r.certifications.join(',')}}` : r.certifications) : null,
            r.source_platform || r._source || null,
            r.source_url || null,
            r.confidence || 'industry_estimate',
          ]
        );
        inserted += res.rowCount;
      }
    }
  });

  log.info(`Inserted ${inserted} supplier records`);
  return { inserted };
}

// ── Companies ──────────────────────────────
// Schema: name, country_code, hq_address, website, revenue, notes
export async function insertCompanies(records) {
  if (!records.length) return { inserted: 0 };
  let inserted = 0;

  await transaction(async (client) => {
    for (const r of records) {
      const name = r.name || r.company_name || null;
      if (!name) continue;

      const countryCode = r.country_code || r.country || null;

      // Check for existing company
      const existing = await client.query(
        `SELECT id FROM companies WHERE name = $1 LIMIT 1`,
        [name]
      );

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE companies SET
             website = COALESCE($1, website),
             revenue = COALESCE($2, revenue),
             updated_at = NOW()
           WHERE id = $3`,
          [
            r.website || null,
            r.revenue || r.estimated_revenue || null,
            existing.rows[0].id,
          ]
        );
        inserted++;
      } else {
        const res = await client.query(
          `INSERT INTO companies (name, country_code, website, revenue, notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            name, countryCode,
            r.website || null,
            r.revenue || r.estimated_revenue || null,
            r.notes || (r.raw_data ? JSON.stringify(r.raw_data) : null),
          ]
        );
        inserted += res.rowCount;
      }
    }
  });

  log.info(`Inserted ${inserted} company records`);
  return { inserted };
}

// ── Price Data ───────────────────────────────
// Schema: source_type (NOT NULL enum), source_name, source_url,
//         price (NOT NULL), currency, price_type,
//         product_title, marketplace, scraped_at, confidence, raw_data
export async function insertPriceData(records) {
  if (!records.length) return { inserted: 0 };
  let inserted = 0;

  await transaction(async (client) => {
    for (const r of records) {
      const price = r.price || r.price_usd || null;
      if (!price || price <= 0) continue;

      // Dedup: skip if same product + source + price exists within last 24 hours
      const existing = await client.query(
        `SELECT id FROM price_data
         WHERE source_name = $1 AND product_title = $2 AND price = $3
           AND scraped_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [
          r.source_name || r.source_platform || r._source || 'unknown',
          r.product_title || r.product_type || r.product_name || null,
          price,
        ]
      );
      if (existing.rows.length > 0) continue;

      const res = await client.query(
        `INSERT INTO price_data
          (source_type, source_name, source_url, hs_code,
           price, currency, price_type,
           product_title, marketplace, scraped_at, confidence)
         VALUES ($1::data_source_type, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::confidence_level)
         RETURNING id`,
        [
          r.source_type || 'scraping',
          r.source_name || r.source_platform || r._source || 'unknown',
          r.source_url || null,
          r.hs_code || null,
          price,
          r.currency || 'USD',
          r.price_type || 'retail',
          r.product_title || r.product_type || r.product_name || null,
          r.marketplace || r.platform || null,
          r.scraped_at || r.recorded_at || new Date().toISOString(),
          r.confidence || 'industry_estimate',
        ]
      );
      inserted += res.rowCount;
    }
  });

  log.info(`Inserted ${inserted} price data records`);
  return { inserted };
}

// ── Pipeline Stats ───────────────────────────
export async function getPipelineStats() {
  const tables = [
    'trade_statistics', 'shipment_records', 'retail_product_data',
    'suppliers', 'companies', 'price_data',
  ];

  const stats = {};
  for (const table of tables) {
    try {
      const res = await query(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = { count: parseInt(res.rows[0].count, 10) };
    } catch {
      stats[table] = { count: 0 };
    }
  }

  return stats;
}

export default {
  insertTradeStatistics, insertShipmentRecords, insertRetailProducts,
  insertSuppliers, insertCompanies, insertPriceData, getPipelineStats,
};
