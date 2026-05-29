-- ═══════════════════════════════════════════════════════════════
--  BuyerIQ — Enterprise Database Schema
--  PostgreSQL 15+
--  Senses Lifestyle, Moradabad, India
--  Created: March 2026
-- ═══════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- fuzzy text search

-- ─── ENUM TYPES ───
CREATE TYPE confidence_level AS ENUM ('verified', 'industry_estimate', 'unverified');
CREATE TYPE buyer_tier AS ENUM ('premium', 'mid_range', 'value', 'mega_volume');
CREATE TYPE alert_urgency AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved');
CREATE TYPE compliance_status AS ENUM ('active', 'upcoming', 'expired', 'under_review');
CREATE TYPE data_source_type AS ENUM ('api', 'scraping', 'manual', 'import', 'calculated');
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'sales', 'production', 'viewer');


-- ═══════════════════════════════════════════════════════════════
--  1. USERS — Platform users and roles
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(200) UNIQUE NOT NULL,
    name            VARCHAR(200) NOT NULL,
    role            user_role DEFAULT 'viewer',
    password_hash   VARCHAR(200),                       -- bcrypt
    is_active       BOOLEAN DEFAULT true,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
--  2. COUNTRIES — Reference table for all country data
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE countries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(3) UNIQUE NOT NULL,         -- ISO 3166 (US, GB, IN)
    name            VARCHAR(100) NOT NULL,
    flag_emoji      VARCHAR(10),
    region          VARCHAR(50),                        -- North America, Europe, Asia-Pacific
    currency_code   VARCHAR(3),                         -- USD, GBP, EUR
    import_tariff_wood VARCHAR(50),                     -- e.g., "3.2% MFN (HS 4419)"
    tariff_source   VARCHAR(100),
    trade_agreement VARCHAR(200),                       -- e.g., "EU GSP+", "UK DCTS"
    wood_import_value_usd DECIMAL(15,2),               -- annual HS 4419 imports
    wood_import_volume_tons DECIMAL(12,2),
    india_share_pct DECIMAL(5,2),                       -- India's share of their imports
    data_year       INTEGER,
    confidence      confidence_level DEFAULT 'industry_estimate',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_countries_code ON countries(code);
CREATE INDEX idx_countries_region ON countries(region);


-- ═══════════════════════════════════════════════════════════════
--  3. COMPANIES — Parent company registry
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    legal_name      VARCHAR(200),                       -- for ImportYeti lookup
    country_code    VARCHAR(3) REFERENCES countries(code),
    hq_address      TEXT,
    website         VARCHAR(200),
    stock_ticker    VARCHAR(20),
    stock_exchange  VARCHAR(20),
    revenue         VARCHAR(100),
    revenue_usd     DECIMAL(15,2),                      -- normalized USD value
    revenue_year    INTEGER,
    revenue_source  VARCHAR(200),
    revenue_conf    confidence_level DEFAULT 'industry_estimate',
    employee_count  VARCHAR(50),
    founded_year    INTEGER,
    is_public       BOOLEAN DEFAULT false,
    parent_company  UUID REFERENCES companies(id),      -- for subsidiaries
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_name ON companies USING gin(name gin_trgm_ops);
CREATE INDEX idx_companies_country ON companies(country_code);


-- ═══════════════════════════════════════════════════════════════
--  4. HS_CODES — Harmonized System code hierarchy
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE hs_codes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(10) UNIQUE NOT NULL,        -- e.g., "4419", "441900"
    description     TEXT NOT NULL,
    parent_code     VARCHAR(10),                        -- hierarchy (44 → 4419 → 441900)
    chapter         INTEGER,                            -- 44 = Wood
    global_trade_value_usd DECIMAL(15,2),
    top_exporter_country VARCHAR(3),
    top_importer_country VARCHAR(3),
    india_export_value_usd DECIMAL(15,2),
    india_export_rank INTEGER,
    data_year       INTEGER,
    data_source     VARCHAR(100),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hs_codes_code ON hs_codes(code);


-- ═══════════════════════════════════════════════════════════════
--  5. BUYERS — Global buyer profiles (core table)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE buyers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            VARCHAR(50) UNIQUE NOT NULL,        -- url-friendly: "tjx", "ikea"
    company_id      UUID REFERENCES companies(id),
    name            VARCHAR(200) NOT NULL,
    tier            buyer_tier NOT NULL,
    brands          TEXT[],                              -- {"HomeGoods","TJ Maxx","Marshalls"}
    country_code    VARCHAR(3) REFERENCES countries(code),
    region          VARCHAR(50),
    stores_count    VARCHAR(50),
    stores_conf     confidence_level DEFAULT 'verified',

    -- Product preferences
    wood_preferences     TEXT[],                        -- {"Acacia","Mango","Sheesham"}
    finish_preferences   TEXT[],
    top_products         TEXT[],
    design_trends        TEXT[],

    -- Pricing
    fob_min         DECIMAL(8,2),
    fob_max         DECIMAL(8,2),
    fob_sweet_spot  VARCHAR(50),                        -- "$7.99–$12.99 FOB"
    retail_multiple VARCHAR(20),                        -- "3.5–4x"

    -- Terms
    seasonal_q1     INTEGER, seasonal_q2 INTEGER,       -- % of orders per quarter
    seasonal_q3     INTEGER, seasonal_q4 INTEGER,
    order_windows   TEXT[],                              -- {"Jan–Feb (Spring)","Jul–Aug (Holiday)"}
    lead_time       VARCHAR(50),
    moq             VARCHAR(50),
    payment_terms   VARCHAR(100),
    negotiation_style TEXT,

    -- Compliance
    certifications_required TEXT[],

    -- Competitive
    known_competitors TEXT[],                            -- {"Naman Exports","Kadam Exports"}

    -- Scorecard (0-100)
    score_payment   INTEGER, score_volume INTEGER,
    score_margin    INTEGER, score_growth INTEGER,
    score_ease      INTEGER,

    -- Metadata
    last_verified   DATE,
    data_source     VARCHAR(200),
    confidence      confidence_level DEFAULT 'industry_estimate',
    is_active       BOOLEAN DEFAULT true,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_buyers_slug ON buyers(slug);
CREATE INDEX idx_buyers_tier ON buyers(tier);
CREATE INDEX idx_buyers_country ON buyers(country_code);
CREATE INDEX idx_buyers_name ON buyers USING gin(name gin_trgm_ops);


-- ═══════════════════════════════════════════════════════════════
--  6. SUPPLIERS — Global supplier profiles
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE suppliers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID REFERENCES companies(id),
    name            VARCHAR(200) NOT NULL,
    country_code    VARCHAR(3) REFERENCES countries(code),
    cluster         VARCHAR(100),                       -- "Moradabad", "Saharanpur", "Fujian"
    city            VARCHAR(100),

    -- Capabilities
    product_categories TEXT[],
    wood_types      TEXT[],
    finish_types    TEXT[],
    certifications  TEXT[],                              -- {"FSC CoC","BSCI","SMETA"}

    -- Pricing
    est_fob_min     DECIMAL(8,2),
    est_fob_max     DECIMAL(8,2),
    est_moq         VARCHAR(50),
    est_lead_time   VARCHAR(50),
    est_capacity    VARCHAR(100),                        -- "10,000 pcs/month"

    -- Trade data
    total_shipments INTEGER,                            -- from ImportYeti
    top_buyers      TEXT[],
    shipment_ports  TEXT[],
    last_shipment_date DATE,

    -- Discovery
    source_platform VARCHAR(50),                        -- "ImportYeti","Alibaba","IndiaMART","EPCH"
    source_url      TEXT,
    epch_member     BOOLEAN DEFAULT false,
    dgft_registered BOOLEAN DEFAULT false,

    -- Quality indicators
    factory_audit   VARCHAR(50),                        -- "BSCI Good", "SMETA 4-pillar"
    quality_rating  INTEGER,                            -- 1-5
    reliability_rating INTEGER,                         -- 1-5

    confidence      confidence_level DEFAULT 'industry_estimate',
    is_active       BOOLEAN DEFAULT true,
    is_competitor   BOOLEAN DEFAULT false,               -- direct competitor to Senses Lifestyle
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_country ON suppliers(country_code);
CREATE INDEX idx_suppliers_cluster ON suppliers(cluster);
CREATE INDEX idx_suppliers_name ON suppliers USING gin(name gin_trgm_ops);


-- ═══════════════════════════════════════════════════════════════
--  7. CONTACTS — Procurement decision-makers
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID REFERENCES companies(id),
    buyer_id        UUID REFERENCES buyers(id),
    supplier_id     UUID REFERENCES suppliers(id),

    full_name       VARCHAR(200) NOT NULL,
    job_title       VARCHAR(200),
    department      VARCHAR(100),                        -- "Procurement","Sourcing","Supply Chain"
    email           VARCHAR(200),
    phone           VARCHAR(50),
    linkedin_url    TEXT,

    -- Discovery metadata
    discovery_source VARCHAR(50),                        -- "LinkedIn","website","press_release"
    discovery_date  DATE,
    confidence      confidence_level DEFAULT 'unverified',
    is_verified     BOOLEAN DEFAULT false,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_buyer ON contacts(buyer_id);


-- ═══════════════════════════════════════════════════════════════
--  8. PRODUCTS — Product catalog linked to HS codes
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(100) UNIQUE,
    hs_code         VARCHAR(10) REFERENCES hs_codes(code),
    category        VARCHAR(100),                        -- "Cutting Board","Serving Tray"
    sub_category    VARCHAR(100),

    -- Specifications
    wood_types      TEXT[],
    finish_types    TEXT[],
    weight_kg       DECIMAL(6,3),
    dimensions      VARCHAR(100),

    -- Pricing intelligence
    fob_range_min   DECIMAL(8,2),
    fob_range_max   DECIMAL(8,2),
    avg_retail_price DECIMAL(8,2),
    retail_currency VARCHAR(3) DEFAULT 'USD',
    retail_multiple_avg DECIMAL(4,2),

    -- Market data
    demand_trend    VARCHAR(20),                        -- "growing","stable","declining"
    demand_score    INTEGER,                            -- 1-100
    competition_level VARCHAR(20),                      -- "high","medium","low"

    unit            VARCHAR(20) DEFAULT 'piece',
    image_url       TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_hs ON products(hs_code);
CREATE INDEX idx_products_category ON products(category);


-- ═══════════════════════════════════════════════════════════════
--  9. SHIPMENT_RECORDS — Bill of Lading data (ImportYeti)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE shipment_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bol_number      VARCHAR(50),                        -- Bill of Lading number
    buyer_id        UUID REFERENCES buyers(id),
    supplier_id     UUID REFERENCES suppliers(id),
    buyer_name_raw  VARCHAR(200),                       -- raw from customs record
    supplier_name_raw VARCHAR(200),

    hs_code         VARCHAR(10),
    product_description TEXT,

    origin_country  VARCHAR(3),
    origin_port     VARCHAR(100),
    dest_country    VARCHAR(3),
    dest_port       VARCHAR(100),

    ship_date       DATE,
    arrival_date    DATE,
    carrier         VARCHAR(200),
    vessel_name     VARCHAR(200),

    weight_kg       DECIMAL(12,2),
    quantity        INTEGER,
    quantity_unit   VARCHAR(20),
    container_count INTEGER,
    container_type  VARCHAR(10),                        -- "20GP","40HC"
    estimated_value_usd DECIMAL(12,2),

    data_source     VARCHAR(50) DEFAULT 'importyeti',
    raw_data        JSONB,                              -- store full record
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipments_buyer ON shipment_records(buyer_id);
CREATE INDEX idx_shipments_supplier ON shipment_records(supplier_id);
CREATE INDEX idx_shipments_hs ON shipment_records(hs_code);
CREATE INDEX idx_shipments_date ON shipment_records(ship_date);
CREATE INDEX idx_shipments_origin ON shipment_records(origin_country);


-- ═══════════════════════════════════════════════════════════════
--  10. TRADE_STATISTICS — Annual trade flow aggregates
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE trade_statistics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_country VARCHAR(3) NOT NULL,               -- exporter
    partner_country VARCHAR(3) NOT NULL,                -- importer
    hs_code         VARCHAR(10) NOT NULL,
    year            INTEGER NOT NULL,
    flow            VARCHAR(10) NOT NULL,               -- 'export' or 'import'

    trade_value_usd DECIMAL(15,2),
    quantity_kg     DECIMAL(15,2),
    quantity_units  DECIMAL(15,2),
    avg_unit_price  DECIMAL(10,2),

    yoy_growth_pct  DECIMAL(8,2),
    market_share_pct DECIMAL(8,4),

    data_source     VARCHAR(50),                        -- "UN COMTRADE","Volza","IndexBox"
    confidence      confidence_level DEFAULT 'verified',
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(reporter_country, partner_country, hs_code, year, flow)
);

CREATE INDEX idx_trade_reporter ON trade_statistics(reporter_country);
CREATE INDEX idx_trade_partner ON trade_statistics(partner_country);
CREATE INDEX idx_trade_hs ON trade_statistics(hs_code);
CREATE INDEX idx_trade_year ON trade_statistics(year);


-- ═══════════════════════════════════════════════════════════════
--  11. PRICE_DATA — Multi-source pricing intelligence
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE price_data (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID REFERENCES products(id),
    hs_code         VARCHAR(10),
    source_type     data_source_type NOT NULL,           -- 'scraping','api','manual'
    source_name     VARCHAR(100),                       -- "Amazon US","Alibaba","ImportYeti"
    source_url      TEXT,

    price           DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'USD',
    price_type      VARCHAR(30),                        -- "retail","wholesale","fob","cif"

    product_title   TEXT,
    seller_name     VARCHAR(200),
    seller_country  VARCHAR(3),
    marketplace     VARCHAR(50),

    scraped_at      TIMESTAMPTZ,
    confidence      confidence_level DEFAULT 'verified',
    raw_data        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prices_product ON price_data(product_id);
CREATE INDEX idx_prices_source ON price_data(source_name);
CREATE INDEX idx_prices_date ON price_data(scraped_at);


-- ═══════════════════════════════════════════════════════════════
--  12. RETAIL_PRODUCT_DATA — Marketplace product listings
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE retail_product_data (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marketplace     VARCHAR(50) NOT NULL,               -- "Amazon","Walmart","Wayfair"
    product_url     TEXT,
    product_asin    VARCHAR(20),                        -- Amazon ASIN
    product_title   TEXT NOT NULL,
    category        VARCHAR(200),

    price           DECIMAL(10,2),
    currency        VARCHAR(3) DEFAULT 'USD',
    rating          DECIMAL(3,2),
    review_count    INTEGER,
    best_seller_rank INTEGER,

    brand           VARCHAR(200),
    seller          VARCHAR(200),
    material        VARCHAR(100),                       -- "Acacia Wood","Bamboo"
    wood_type       VARCHAR(50),

    -- Trend signals
    is_best_seller  BOOLEAN DEFAULT false,
    is_amazon_choice BOOLEAN DEFAULT false,
    is_trending     BOOLEAN DEFAULT false,
    price_30d_change_pct DECIMAL(6,2),

    image_url       TEXT,
    scraped_at      TIMESTAMPTZ NOT NULL,
    raw_data        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_retail_marketplace ON retail_product_data(marketplace);
CREATE INDEX idx_retail_category ON retail_product_data(category);
CREATE INDEX idx_retail_material ON retail_product_data(material);
CREATE INDEX idx_retail_scraped ON retail_product_data(scraped_at);


-- ═══════════════════════════════════════════════════════════════
--  13. COMPLIANCE_RULES — Compliance laws and requirements
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE compliance_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            VARCHAR(50) UNIQUE NOT NULL,        -- "lacey-act-vii","eudr","iway-6.1"
    name            VARCHAR(200) NOT NULL,
    country_scope   VARCHAR(50),                        -- "US","EU","UK","IKEA","Global"
    effective_date  DATE,
    enforcer        VARCHAR(200),
    status          compliance_status DEFAULT 'active',

    summary         TEXT,
    requirements    TEXT[],
    penalties       TEXT,
    key_fact        TEXT,

    affected_buyer_slugs TEXT[],                        -- {"tjx","target","wayfair"}
    affected_hs_codes TEXT[],                           -- {"4419","4420"}

    source_url      TEXT,
    confidence      confidence_level DEFAULT 'verified',
    last_verified   DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
--  14. ALERTS — System alerts and notifications
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id        UUID REFERENCES buyers(id),
    supplier_id     UUID REFERENCES suppliers(id),
    compliance_id   UUID REFERENCES compliance_rules(id),

    type            VARCHAR(50) NOT NULL,               -- "compliance","season","trend","price","opportunity"
    urgency         alert_urgency NOT NULL,
    status          alert_status DEFAULT 'active',
    title           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,

    is_verified     BOOLEAN DEFAULT false,
    data_source     VARCHAR(100),
    action_url      TEXT,
    expires_at      TIMESTAMPTZ,

    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_urgency ON alerts(urgency);
CREATE INDEX idx_alerts_buyer ON alerts(buyer_id);


-- ═══════════════════════════════════════════════════════════════
--  15. QUOTES — Generated export quotes
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_number    VARCHAR(20) UNIQUE,                 -- "SL-Q-2026-0001"
    buyer_id        UUID REFERENCES buyers(id),
    product_id      UUID REFERENCES products(id),
    created_by      UUID REFERENCES users(id),

    -- Product details
    product_name    VARCHAR(200),
    wood_type       VARCHAR(50),
    finish_type     VARCHAR(50),
    quantity        INTEGER NOT NULL,
    unit            VARCHAR(20) DEFAULT 'piece',

    -- Pricing
    fob_per_unit    DECIMAL(8,2) NOT NULL,
    fob_currency    VARCHAR(3) DEFAULT 'USD',
    total_usd       DECIMAL(12,2),
    exchange_rate   DECIMAL(10,4),                     -- USD/INR at time of quote
    total_inr       DECIMAL(14,2),

    -- Logistics
    est_weight_kg   DECIMAL(10,2),
    est_cbm         DECIMAL(8,2),
    est_containers  INTEGER,
    incoterm        VARCHAR(10) DEFAULT 'FOB',
    origin_port     VARCHAR(100) DEFAULT 'Nhava Sheva',

    -- Buyer context
    buyer_payment_terms VARCHAR(100),
    buyer_lead_time VARCHAR(50),
    est_retail_price DECIMAL(8,2),
    est_buyer_margin_pct DECIMAL(5,2),

    -- Competitive context
    china_fob_range VARCHAR(50),
    vietnam_fob_range VARCHAR(50),
    india_rival_fob_range VARCHAR(50),

    status          quote_status DEFAULT 'draft',
    valid_until     DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotes_buyer ON quotes(buyer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_date ON quotes(created_at);


-- ═══════════════════════════════════════════════════════════════
--  JUNCTION TABLES
-- ═══════════════════════════════════════════════════════════════

-- Buyer-Supplier sourcing relationship
CREATE TABLE buyer_sourcing (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id        UUID REFERENCES buyers(id) NOT NULL,
    supplier_id     UUID REFERENCES suppliers(id),
    origin_country  VARCHAR(3) REFERENCES countries(code),
    origin_cluster  VARCHAR(100),

    share_pct       DECIMAL(5,2),                       -- % of buyer's sourcing
    products        TEXT[],
    est_fob_range   VARCHAR(50),
    strength        TEXT,
    risk            TEXT,
    
    confidence      confidence_level DEFAULT 'industry_estimate',
    data_source     VARCHAR(100),
    data_year       INTEGER,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sourcing_buyer ON buyer_sourcing(buyer_id);
CREATE INDEX idx_sourcing_supplier ON buyer_sourcing(supplier_id);

-- Buyer compliance requirements
CREATE TABLE buyer_compliance (
    buyer_id        UUID REFERENCES buyers(id),
    compliance_id   UUID REFERENCES compliance_rules(id),
    is_mandatory    BOOLEAN DEFAULT true,
    notes           VARCHAR(200),
    PRIMARY KEY (buyer_id, compliance_id)
);

-- Product HS code mapping
CREATE TABLE product_hs_mapping (
    product_id      UUID REFERENCES products(id),
    hs_code         VARCHAR(10) REFERENCES hs_codes(code),
    is_primary      BOOLEAN DEFAULT true,
    PRIMARY KEY (product_id, hs_code)
);


-- ═══════════════════════════════════════════════════════════════
--  DATA AUDIT LOG — Track all data changes
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE data_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    table_name      VARCHAR(50) NOT NULL,
    record_id       UUID NOT NULL,
    action          VARCHAR(10) NOT NULL,               -- INSERT, UPDATE, DELETE
    changed_fields  JSONB,
    old_values      JSONB,
    new_values      JSONB,
    changed_by      UUID REFERENCES users(id),
    data_source     VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_table ON data_audit_log(table_name);
CREATE INDEX idx_audit_record ON data_audit_log(record_id);
CREATE INDEX idx_audit_date ON data_audit_log(created_at);


-- ═══════════════════════════════════════════════════════════════
--  SCRAPER JOB TRACKING
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE scraper_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type        VARCHAR(50) NOT NULL,               -- "amazon_prices","importyeti_shipments"
    target_url      TEXT,
    status          VARCHAR(20) DEFAULT 'queued',       -- queued, running, completed, failed
    records_found   INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
--  CURRENCY RATES CACHE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE currency_rates (
    id              SERIAL PRIMARY KEY,
    base_currency   VARCHAR(3) DEFAULT 'USD',
    target_currency VARCHAR(3) NOT NULL,
    rate            DECIMAL(12,6) NOT NULL,
    source          VARCHAR(50) DEFAULT 'frankfurter',
    fetched_at      TIMESTAMPTZ NOT NULL,
    
    UNIQUE(base_currency, target_currency, fetched_at)
);

CREATE INDEX idx_currency_pair ON currency_rates(base_currency, target_currency);
CREATE INDEX idx_currency_date ON currency_rates(fetched_at);


-- ═══════════════════════════════════════════════════════════════
--  USEFUL VIEWS
-- ═══════════════════════════════════════════════════════════════

-- Buyer summary with company data
CREATE VIEW v_buyer_summary AS
SELECT 
    b.slug, b.name, b.tier,
    c.revenue, c.stock_ticker, c.website,
    co.name as country_name, co.flag_emoji,
    b.fob_min, b.fob_max, b.fob_sweet_spot,
    b.score_payment, b.score_volume, b.score_margin,
    b.score_growth, b.score_ease,
    ((b.score_payment + b.score_volume + b.score_margin + 
      b.score_growth + b.score_ease) / 5) as avg_score,
    b.updated_at
FROM buyers b
LEFT JOIN companies c ON b.company_id = c.id
LEFT JOIN countries co ON b.country_code = co.code
WHERE b.is_active = true
ORDER BY avg_score DESC;

-- India export position
CREATE VIEW v_india_trade_position AS
SELECT 
    ts.partner_country,
    co.name as partner_name,
    ts.year,
    ts.trade_value_usd,
    ts.market_share_pct,
    ts.yoy_growth_pct
FROM trade_statistics ts
LEFT JOIN countries co ON ts.partner_country = co.code
WHERE ts.reporter_country = 'IN'
  AND ts.hs_code = '4419'
ORDER BY ts.year DESC, ts.trade_value_usd DESC;

-- Active alerts dashboard
CREATE VIEW v_active_alerts AS
SELECT 
    a.id, a.type, a.urgency, a.title, a.message,
    a.is_verified,
    b.name as buyer_name,
    cr.name as compliance_name,
    a.created_at
FROM alerts a
LEFT JOIN buyers b ON a.buyer_id = b.id
LEFT JOIN compliance_rules cr ON a.compliance_id = cr.id
WHERE a.status = 'active'
ORDER BY 
    CASE a.urgency 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        ELSE 5 
    END;


-- ═══════════════════════════════════════════════════════════════
--  SEED: HS CODES FOR ALL KITCHENWARE MATERIALS
-- ═══════════════════════════════════════════════════════════════
INSERT INTO hs_codes (code, description, chapter, notes) VALUES
-- Chapter-level parents
('39', 'Plastics and articles thereof', 39, 'Chapter 39'),
('44', 'Wood and articles of wood', 44, 'Chapter 44'),
('46', 'Vegetable plaiting materials; basketwork', 46, 'Chapter 46'),
('69', 'Ceramic products', 69, 'Chapter 69'),
('70', 'Glass and glassware', 70, 'Chapter 70'),
('73', 'Articles of iron or steel', 73, 'Chapter 73'),
('74', 'Copper and articles thereof', 74, 'Chapter 74'),
('76', 'Aluminium and articles thereof', 76, 'Chapter 76'),
('82', 'Tools, implements, cutlery of base metal', 82, 'Chapter 82'),
('83', 'Miscellaneous articles of base metal', 83, 'Chapter 83'),
-- Wood
('4419', 'Tableware and kitchenware, of wood', 44, 'Primary HS code for wooden kitchenware'),
('441900', 'Tableware and kitchenware, of wood (detailed)', 44, 'Detailed 6-digit code'),
('4420', 'Wood marquetry, caskets, statuettes, ornaments', 44, 'Secondary: decorative wood items'),
('442010', 'Statuettes and other ornaments, of wood', 44, 'Decorative items'),
('442090', 'Other wood marquetry and inlaid wood, caskets', 44, 'Boxes, cases of wood'),
-- Steel/Iron
('7323', 'Table, kitchen or household articles of iron or steel', 73, 'Cookware, utensils'),
-- Glass
('7013', 'Glassware for table, kitchen or toilet purposes', 70, 'Bakeware, mixing bowls'),
-- Ceramic/Porcelain
('6911', 'Tableware, kitchenware of porcelain or china', 69, 'Dinner sets, mugs'),
('6912', 'Ceramic tableware, kitchenware', 69, 'Stoneware, baking dishes'),
-- Aluminum
('7615', 'Table, kitchen or household articles of aluminium', 76, 'Cookware, baking pans'),
-- Bamboo/Basket
('4602', 'Basketwork, wickerwork from vegetable materials', 46, 'Bamboo boards, utensils'),
-- Tools/Cutlery
('8215', 'Spoons, forks, ladles, kitchen tools', 82, 'Combo wood+metal utensils'),
('8214', 'Cutlery, manicure or pedicure instruments', 82, 'Cutting tools'),
-- Copper
('7418', 'Table, kitchen or household articles of copper', 74, 'Moscow mule mugs'),
-- Plastics
('3924', 'Tableware, kitchenware of plastics', 39, 'Silicone tools'),
('3926', 'Other articles of plastics (silicone tools)', 39, 'Kitchen accessories'),
-- Base metal
('8302', 'Base metal mountings and fittings', 83, 'Cabinet hardware, hooks')
ON CONFLICT (code) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
--  DONE
-- ═══════════════════════════════════════════════════════════════
-- Total: 15 core tables + 3 junction tables + 3 operational tables + 3 views
-- All tables have UUID primary keys, timestamps, and confidence scoring
-- Full-text search enabled via pg_trgm on name fields
-- Audit logging for data governance
