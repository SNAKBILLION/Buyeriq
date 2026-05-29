-- ═══════════════════════════════════════════════════════════════
--  BuyerIQ — Migration 003: Row Level Security (RLS)
--  Run AFTER 002_dedup_indexes.sql
-- ═══════════════════════════════════════════════════════════════
--
--  STRATEGY:
--  - Service role (backend) bypasses RLS (default Supabase behavior)
--  - Anon/authenticated users via Supabase client get RLS enforced
--  - This protects against direct Supabase client access from frontend
--  - Backend API still uses service_role key → unaffected
--
--  IMPORTANT: Run this on your Supabase SQL Editor, not via pg directly
-- ═══════════════════════════════════════════════════════════════

-- ── Helper: Check if user is authenticated via Supabase auth ──
CREATE OR REPLACE FUNCTION auth_uid() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth_email() RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json ->> 'email',
    ''
  );
$$ LANGUAGE sql STABLE;

-- ═══════════════════════════════════════════
--  ENABLE RLS ON ALL TABLES
-- ═══════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_product_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_sourcing ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_hs_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_rates ENABLE ROW LEVEL SECURITY;

-- Don't enable on reference tables (countries, hs_codes — public read OK)
-- Don't enable on scraper_jobs (internal only)

-- ═══════════════════════════════════════════
--  POLICIES: Authenticated users can READ all data
-- ═══════════════════════════════════════════

-- Read policy for all data tables (any authenticated user)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'users','companies','buyers','suppliers','contacts','products',
    'shipment_records','trade_statistics','price_data','retail_product_data',
    'compliance_rules','alerts','quotes','buyer_sourcing','buyer_compliance',
    'product_hs_mapping','currency_rates'
  ])
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      'allow_read_' || tbl, tbl
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════
--  POLICIES: Write access (INSERT/UPDATE/DELETE)
-- ═══════════════════════════════════════════

-- Helper: Check app-level role from users table
CREATE OR REPLACE FUNCTION user_role() RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM users WHERE email = auth_email() AND is_active = true LIMIT 1),
    'viewer'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT user_role() = 'admin';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_writer() RETURNS BOOLEAN AS $$
  SELECT user_role() IN ('admin', 'manager');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Users table: only admins can modify ──
CREATE POLICY allow_insert_users ON users FOR INSERT TO authenticated
  WITH CHECK (is_admin());
CREATE POLICY allow_update_users ON users FOR UPDATE TO authenticated
  USING (is_admin());
CREATE POLICY allow_delete_users ON users FOR DELETE TO authenticated
  USING (is_admin());

-- ── Data tables: admin + manager can write ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'companies','buyers','suppliers','contacts','products',
    'shipment_records','trade_statistics','price_data','retail_product_data',
    'compliance_rules','alerts','buyer_sourcing','buyer_compliance',
    'product_hs_mapping','currency_rates'
  ])
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (is_writer())',
      'allow_insert_' || tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (is_writer())',
      'allow_update_' || tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (is_admin())',
      'allow_delete_' || tbl, tbl
    );
  END LOOP;
END $$;

-- ── Quotes: admin + manager + sales can create/update ──
CREATE POLICY allow_insert_quotes ON quotes FOR INSERT TO authenticated
  WITH CHECK (user_role() IN ('admin', 'manager', 'sales'));
CREATE POLICY allow_update_quotes ON quotes FOR UPDATE TO authenticated
  USING (user_role() IN ('admin', 'manager', 'sales'));
CREATE POLICY allow_delete_quotes ON quotes FOR DELETE TO authenticated
  USING (is_admin());

-- ── Audit log: read-only (insert by system only via service_role) ──
CREATE POLICY allow_read_audit ON data_audit_log FOR SELECT TO authenticated
  USING (is_admin());
-- No INSERT/UPDATE/DELETE for authenticated — only service_role can write

-- ═══════════════════════════════════════════
--  POLICIES: Service role bypasses all RLS
--  (This is default Supabase behavior — no action needed)
--  Backend uses service_role key → full access
-- ═══════════════════════════════════════════
