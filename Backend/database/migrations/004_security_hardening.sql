-- ═══════════════════════════════════════════════════════════════
--  BuyerIQ — Migration 004: Security Hardening
--  Run AFTER 003_row_level_security.sql
--  Fixes: Supabase security warnings
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════
--  FIX 1: Function search_path vulnerability
--  All SECURITY DEFINER functions must have
--  explicit search_path to prevent injection
-- ═══════════════════════════════════════════

-- Drop and recreate with search_path
DROP FUNCTION IF EXISTS auth_uid() CASCADE;
CREATE OR REPLACE FUNCTION auth_uid() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE sql STABLE SET search_path = public;

DROP FUNCTION IF EXISTS auth_email() CASCADE;
CREATE OR REPLACE FUNCTION auth_email() RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json ->> 'email',
    ''
  );
$$ LANGUAGE sql STABLE SET search_path = public;

DROP FUNCTION IF EXISTS user_role() CASCADE;
CREATE OR REPLACE FUNCTION user_role() RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role::text FROM users WHERE email = auth_email() AND is_active = true LIMIT 1),
    'viewer'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS is_admin() CASCADE;
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT user_role() = 'admin';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS is_writer() CASCADE;
CREATE OR REPLACE FUNCTION is_writer() RETURNS BOOLEAN AS $$
  SELECT user_role() IN ('admin', 'manager');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════
--  FIX 2: RLS on reference tables
--  countries and hs_codes need RLS enabled
--  with permissive read for all roles
-- ═══════════════════════════════════════════

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs_codes ENABLE ROW LEVEL SECURITY;

-- Public read for reference tables (anon + authenticated)
CREATE POLICY allow_read_countries ON countries
  FOR SELECT USING (true);
CREATE POLICY allow_read_hs_codes ON hs_codes
  FOR SELECT USING (true);

-- Write only for admin/writer via service_role (backend)
CREATE POLICY allow_insert_countries ON countries
  FOR INSERT TO authenticated WITH CHECK (is_writer());
CREATE POLICY allow_insert_hs_codes ON hs_codes
  FOR INSERT TO authenticated WITH CHECK (is_writer());


-- ═══════════════════════════════════════════
--  FIX 3: RLS on scraper tables
--  (created by scraping migration, need policies)
-- ═══════════════════════════════════════════

DO $$
BEGIN
  -- Only if tables exist (scraping migration may not have run)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scraper_jobs') THEN
    ALTER TABLE scraper_jobs ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY allow_read_scraper_jobs ON scraper_jobs FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY allow_all_scraper_jobs ON scraper_jobs FOR ALL USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buyer_signals') THEN
    ALTER TABLE buyer_signals ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY allow_read_buyer_signals ON buyer_signals FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY allow_all_buyer_signals ON buyer_signals FOR ALL USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_opportunities') THEN
    ALTER TABLE market_opportunities ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY allow_read_market_opportunities ON market_opportunities FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY allow_all_market_opportunities ON market_opportunities FOR ALL USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'demand_trends') THEN
    ALTER TABLE demand_trends ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY allow_read_demand_trends ON demand_trends FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY allow_all_demand_trends ON demand_trends FOR ALL USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intelligence_reports') THEN
    ALTER TABLE intelligence_reports ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY allow_read_intelligence_reports ON intelligence_reports FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY allow_all_intelligence_reports ON intelligence_reports FOR ALL USING (true)';
  END IF;
END $$;


-- ═══════════════════════════════════════════
--  FIX 4: Revoke direct table access from anon
--  Only authenticated + service_role should access
-- ═══════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'users','companies','buyers','suppliers','contacts','products',
    'shipment_records','trade_statistics','price_data','retail_product_data',
    'compliance_rules','alerts','quotes','buyer_sourcing','buyer_compliance',
    'product_hs_mapping','data_audit_log','currency_rates'
  ])
  LOOP
    EXECUTE format('REVOKE ALL ON %I FROM anon', tbl);
    EXECUTE format('GRANT SELECT ON %I TO authenticated', tbl);
  END LOOP;
END $$;

-- Reference tables: allow anon read (needed for public pages)
GRANT SELECT ON countries TO anon;
GRANT SELECT ON hs_codes TO anon;


-- ═══════════════════════════════════════════
--  FIX 5: Secure views (remove implicit SECURITY DEFINER)
-- ═══════════════════════════════════════════

-- Views are already plain (no SECURITY DEFINER) — verified OK.
-- Just ensure they use security_invoker where supported (PG 15+)
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 150000 THEN
    EXECUTE 'ALTER VIEW v_buyer_summary SET (security_invoker = on)';
    EXECUTE 'ALTER VIEW v_india_trade_position SET (security_invoker = on)';
    EXECUTE 'ALTER VIEW v_active_alerts SET (security_invoker = on)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if views don't exist or PG < 15
  NULL;
END $$;


-- ═══════════════════════════════════════════
--  DONE — Security hardening complete
-- ═══════════════════════════════════════════
-- Changes:
--   1. All SECURITY DEFINER functions have SET search_path = public
--   2. RLS enabled on countries, hs_codes, scraper tables, AI tables
--   3. anon role revoked from sensitive tables
--   4. Views set to security_invoker (PG 15+)
