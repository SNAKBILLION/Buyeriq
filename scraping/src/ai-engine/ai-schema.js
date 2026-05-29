// ─────────────────────────────────────────────
// BuyerIQ — AI Intelligence Schema Migration
// ─────────────────────────────────────────────
// Tables: buyer_signals, market_opportunities,
//         demand_trends, intelligence_reports
// ─────────────────────────────────────────────
import { query } from '../config/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ai-schema');

export const AI_SCHEMA = `

-- ═══════════════════════════════════════════
-- BUYER SIGNALS — detected buyer opportunities
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS buyer_signals (
  id                    SERIAL PRIMARY KEY,
  company_name          VARCHAR(300) NOT NULL,
  country               VARCHAR(100),
  country_code          VARCHAR(10),
  buyer_type            VARCHAR(50),
  signal_type           VARCHAR(50) NOT NULL,

  -- Volume signals
  total_shipments       INTEGER DEFAULT 0,
  total_weight_kg       REAL DEFAULT 0,
  total_value_usd       REAL DEFAULT 0,
  volume_tier           VARCHAR(20),

  -- Frequency signals
  frequency             VARCHAR(30),
  avg_days_between      INTEGER,
  first_shipment_date   DATE,
  last_shipment_date    DATE,

  -- Sourcing signals
  sourcing_countries    JSONB DEFAULT '[]',
  sourcing_country_count INTEGER DEFAULT 0,
  sources_from_india    BOOLEAN DEFAULT FALSE,
  supplier_count        INTEGER DEFAULT 0,
  top_suppliers         JSONB DEFAULT '[]',

  -- Product signals
  hs_codes              JSONB DEFAULT '[]',
  relevant_hs_codes     JSONB DEFAULT '[]',
  is_kitchenware_buyer         BOOLEAN DEFAULT FALSE,
  product_categories    JSONB DEFAULT '[]',

  -- Scoring
  buyer_score           INTEGER DEFAULT 0,
  confidence_score      INTEGER DEFAULT 0,
  signal_source         VARCHAR(100),

  -- Metadata
  raw_data              JSONB,
  detected_at           TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_buyer_signal UNIQUE (company_name, country, signal_type)
);

CREATE INDEX IF NOT EXISTS idx_buyer_signals_score ON buyer_signals(buyer_score DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_signals_country ON buyer_signals(country_code);
CREATE INDEX IF NOT EXISTS idx_buyer_signals_type ON buyer_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_buyer_signals_active ON buyer_signals(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_buyer_signals_wood ON buyer_signals(is_kitchenware_buyer) WHERE is_kitchenware_buyer = TRUE;

-- ═══════════════════════════════════════════
-- MARKET OPPORTUNITIES — detected export opps
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS market_opportunities (
  id                    SERIAL PRIMARY KEY,
  market_country        VARCHAR(100) NOT NULL,
  market_country_code   VARCHAR(10),
  hs_code               VARCHAR(10),
  product_category      VARCHAR(100),

  -- Opportunity metrics
  opportunity_score     INTEGER DEFAULT 0,
  opportunity_type      VARCHAR(50) NOT NULL,
  demand_score          INTEGER DEFAULT 0,
  competition_score     INTEGER DEFAULT 0,
  price_advantage_score INTEGER DEFAULT 0,
  growth_score          INTEGER DEFAULT 0,
  accessibility_score   INTEGER DEFAULT 0,

  -- Market data
  import_value_usd      REAL,
  import_growth_pct     REAL,
  india_share_pct       REAL,
  india_growth_pct      REAL,
  top_competitors       JSONB DEFAULT '[]',
  buyer_count           INTEGER DEFAULT 0,

  -- Price signals
  avg_import_price_ton  REAL,
  india_fob_advantage   REAL,
  retail_price_range    JSONB,

  -- Supply gap
  supply_gap_detected   BOOLEAN DEFAULT FALSE,
  supply_gap_details    TEXT,

  -- Insight
  insight_text          TEXT,
  recommended_actions   JSONB DEFAULT '[]',

  -- Metadata
  data_sources          JSONB DEFAULT '[]',
  confidence_score      INTEGER DEFAULT 0,
  analysis_period       VARCHAR(50),
  detected_at           TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_market_opp UNIQUE (market_country_code, hs_code, opportunity_type)
);

CREATE INDEX IF NOT EXISTS idx_mkt_opp_score ON market_opportunities(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_opp_country ON market_opportunities(market_country_code);
CREATE INDEX IF NOT EXISTS idx_mkt_opp_active ON market_opportunities(is_active) WHERE is_active = TRUE;

-- ═══════════════════════════════════════════
-- DEMAND TRENDS — product demand signals
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS demand_trends (
  id                    SERIAL PRIMARY KEY,
  product_category      VARCHAR(100) NOT NULL,
  hs_code               VARCHAR(10),
  market_country        VARCHAR(100),
  market_country_code   VARCHAR(10),

  -- Demand metrics
  demand_score          INTEGER DEFAULT 0,
  demand_trend          VARCHAR(30),
  growth_rate_pct       REAL,
  yoy_change_pct        REAL,

  -- Trade data
  current_value_usd     REAL,
  previous_value_usd    REAL,
  import_volume_tons    REAL,

  -- Marketplace signals
  retail_product_count  INTEGER DEFAULT 0,
  avg_retail_price      REAL,
  avg_rating            REAL,
  total_reviews         INTEGER DEFAULT 0,

  -- Shipment signals
  shipment_count        INTEGER DEFAULT 0,
  unique_importers      INTEGER DEFAULT 0,
  shipment_growth_pct   REAL,

  -- Seasonality
  peak_quarter          VARCHAR(10),
  seasonal_pattern      JSONB,

  -- Metadata
  data_sources          JSONB DEFAULT '[]',
  confidence_score      INTEGER DEFAULT 0,
  analysis_period       VARCHAR(50),
  detected_at           TIMESTAMPTZ DEFAULT NOW(),
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_demand_trend UNIQUE (product_category, market_country_code, hs_code)
);

CREATE INDEX IF NOT EXISTS idx_demand_score ON demand_trends(demand_score DESC);
CREATE INDEX IF NOT EXISTS idx_demand_trend ON demand_trends(demand_trend);
CREATE INDEX IF NOT EXISTS idx_demand_country ON demand_trends(market_country_code);

-- ═══════════════════════════════════════════
-- INTELLIGENCE REPORTS — generated insights
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS intelligence_reports (
  id                    SERIAL PRIMARY KEY,
  report_type           VARCHAR(50) NOT NULL,
  title                 VARCHAR(500) NOT NULL,
  insight_text          TEXT NOT NULL,
  severity              VARCHAR(20) DEFAULT 'info',
  category              VARCHAR(50),

  -- Context
  related_country       VARCHAR(100),
  related_company       VARCHAR(300),
  related_hs_code       VARCHAR(10),
  related_product       VARCHAR(200),

  -- Scores
  relevance_score       INTEGER DEFAULT 0,
  confidence_score      INTEGER DEFAULT 0,
  impact_score          INTEGER DEFAULT 0,

  -- Actionability
  recommended_actions   JSONB DEFAULT '[]',
  target_audience       VARCHAR(50),

  -- Source references
  data_sources          JSONB DEFAULT '[]',
  supporting_data       JSONB,

  -- Metadata
  detected_at           TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,
  is_read               BOOLEAN DEFAULT FALSE,
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intel_type ON intelligence_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_intel_severity ON intelligence_reports(severity);
CREATE INDEX IF NOT EXISTS idx_intel_relevance ON intelligence_reports(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_intel_active ON intelligence_reports(is_active) WHERE is_active = TRUE;
`;

export async function migrateAISchema() {
  try {
    await query(AI_SCHEMA);
    log.info('✓ AI intelligence tables created/verified');

    const result = await query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('buyer_signals', 'market_opportunities', 'demand_trends', 'intelligence_reports')
      ORDER BY table_name
    `);
    log.info(`Verified ${result.rows.length}/4 AI tables`);
    return result.rows.length === 4;
  } catch (err) {
    log.error('AI schema migration failed', { error: err.message });
    throw err;
  }
}

export default { AI_SCHEMA, migrateAISchema };
