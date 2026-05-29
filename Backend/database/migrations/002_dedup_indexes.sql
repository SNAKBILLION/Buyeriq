-- ═══════════════════════════════════════════════════════════════
--  BuyerIQ — Migration 002: Dedup Indexes + Schema Improvements
--  Run AFTER 001_initial_schema.sql
-- ═══════════════════════════════════════════════════════════════

-- ── Retail Product Dedup Index ──
CREATE UNIQUE INDEX IF NOT EXISTS idx_retail_dedup_asin
  ON retail_product_data (marketplace, product_asin)
  WHERE product_asin IS NOT NULL;

-- Fallback dedup for products without ASIN (Walmart etc)
CREATE UNIQUE INDEX IF NOT EXISTS idx_retail_dedup_url
  ON retail_product_data (marketplace, product_url)
  WHERE product_asin IS NULL AND product_url IS NOT NULL;

-- ── Shipment Record Dedup Index ──
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_dedup
  ON shipment_records (buyer_name_raw, supplier_name_raw, ship_date, hs_code)
  WHERE buyer_name_raw IS NOT NULL AND ship_date IS NOT NULL;

-- ── Price Data Performance Index ──
CREATE INDEX IF NOT EXISTS idx_price_dedup_check
  ON price_data (source_name, product_title, price, scraped_at);

-- ── Material field index on retail ──
CREATE INDEX IF NOT EXISTS idx_retail_material
  ON retail_product_data (material) WHERE material IS NOT NULL;

-- ── HS Code index on price_data ──
CREATE INDEX IF NOT EXISTS idx_price_hs_code
  ON price_data (hs_code) WHERE hs_code IS NOT NULL;
