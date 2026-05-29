# BuyerIQ — Scraping Infrastructure & AI Pipeline Design
## Technical Implementation Guide

---

## 1. SCRAPING ARCHITECTURE

### 1.1 System Overview

```
                    ┌─────────────────────────────┐
                    │       SCHEDULER (CRON)       │
                    │  Currency: */5 * * * *       │
                    │  Retail:   0 * * * *         │
                    │  Buyers:   0 2 * * *         │
                    │  Trade:    0 3 1 * *         │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │     TASK QUEUE (Bull/Redis)   │
                    │                              │
                    │  Priority 1: Currency API    │
                    │  Priority 2: Retail scraping │
                    │  Priority 3: Shipment data   │
                    │  Priority 4: Buyer discovery │
                    │  Priority 5: Supplier scan   │
                    └──────────┬──────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
   ┌────────▼───────┐ ┌───────▼────────┐ ┌──────▼────────┐
   │ API WORKERS    │ │ SCRAPER AGENTS │ │ FILE IMPORTERS│
   │ (Node.js)     │ │ (Playwright)   │ │ (Python)      │
   │               │ │                │ │               │
   │ - Frankfurter │ │ - Amazon       │ │ - COMTRADE CSV│
   │ - COMTRADE    │ │ - Walmart      │ │ - Volza export│
   │ - WTO Tariff  │ │ - Wayfair      │ │ - IndexBox    │
   │ - ImportYeti  │ │ - Alibaba      │ │ - Manual data │
   │ - NewsAPI     │ │ - IndiaMART    │ │               │
   └────────┬──────┘ │ - EPCH         │ └───────┬───────┘
            │        │ - Company sites │         │
            │        └────────┬───────┘         │
            │                 │                  │
            └────────┬────────┴──────────────────┘
                     │
          ┌──────────▼──────────────────┐
          │     RAW DATA STORAGE        │
          │     (S3 / Local filesystem) │
          │                             │
          │  /raw/amazon/2026-03-09/    │
          │  /raw/importyeti/2026-03/   │
          │  /raw/comtrade/2023/        │
          │  /raw/alibaba/2026-03-09/   │
          └──────────┬──────────────────┘
                     │
          ┌──────────▼──────────────────┐
          │    AI DATA CLEANING         │
          │    (Python pipeline)        │
          │                             │
          │  1. Parse raw HTML/JSON     │
          │  2. Deduplicate records     │
          │  3. Normalize entities      │
          │  4. Confidence scoring      │
          │  5. Entity matching (fuzzy) │
          │  6. Validate data quality   │
          └──────────┬──────────────────┘
                     │
          ┌──────────▼──────────────────┐
          │    PostgreSQL (Structured)   │
          │    + data_audit_log         │
          └─────────────────────────────┘
```

### 1.2 Scraper Agent Designs

#### Amazon Scraper (Playwright)
```
Target: amazon.com/s?k=wooden+cutting+board
Frequency: Hourly (top 100 results)
Extracts:
  - Product title, ASIN, price, rating, review_count
  - Best Seller Rank, Amazon's Choice badge
  - Material (wood type), brand, seller
  - Price history (30-day change)
Anti-detection:
  - Rotating residential proxies
  - Random delays (2-8 seconds)
  - Browser fingerprint randomization
  - Headless with stealth plugin
Output: retail_product_data table
```

#### ImportYeti Scraper / API
```
Target: importyeti.com/company/{buyer_name}
Frequency: Daily
Extracts:
  - Supplier list per buyer
  - Shipment count per supplier
  - Origin countries, ports
  - HS codes, product descriptions
  - Container types, weight estimates
Anti-detection: API preferred (paid plan)
Output: shipment_records + suppliers tables
```

#### Alibaba Supplier Scraper
```
Target: alibaba.com/trade/search?SearchText=wooden+kitchenware
Frequency: Weekly
Extracts:
  - Supplier name, country, city
  - MOQ, price range, lead time
  - Certifications (FSC, BSCI, ISO)
  - Transaction history, response rate
  - Product categories
Output: suppliers table
```

#### UN COMTRADE API Client
```
Endpoint: comtradeapi.un.org/data/v1/get/C/A
Parameters: reporterCode=699&partnerCode=842&cmdCode=4419&period=2023
Frequency: Monthly
Extracts:
  - Bilateral trade values (India→US, India→UK, etc.)
  - Quantity in kg and units
  - Average unit value
Output: trade_statistics table
```

### 1.3 Rate Limiting & Ethics

| Target | Requests/min | Delay | Proxy | robots.txt |
|--------|-------------|-------|-------|------------|
| Amazon | 10 | 3-8s random | Yes (rotating) | Respect |
| Walmart | 10 | 3-8s random | Yes | Respect |
| Wayfair | 5 | 5-10s | Yes | Respect |
| Alibaba | 8 | 3-6s | Yes | Respect |
| IndiaMART | 5 | 5-10s | Optional | Respect |
| ImportYeti | API limits | N/A | No | API TOS |
| COMTRADE | API limits | N/A | No | API TOS |
| Company sites | 3 | 5-15s | Optional | Respect |

---

## 2. AI/ML PIPELINE

### 2.1 Pipeline Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  DATA LAKE (PostgreSQL + S3)             │
│                                                         │
│  trade_statistics │ shipment_records │ retail_products   │
│  price_data │ buyers │ suppliers │ currency_rates        │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│              FEATURE ENGINEERING (Python)                 │
│                                                          │
│  Time series features:                                   │
│    - 3/6/12 month moving averages on trade values       │
│    - YoY growth rates per country pair                  │
│    - Seasonal decomposition (Q1-Q4 patterns)            │
│                                                          │
│  Market features:                                        │
│    - Market share by origin country                     │
│    - Price competitiveness index (India vs China FOB)   │
│    - Retail-to-FOB multiple trends                      │
│    - Product category demand scores                     │
│                                                          │
│  Buyer features:                                        │
│    - Sourcing diversification index                     │
│    - Order frequency patterns                           │
│    - Price sensitivity score                            │
│    - Compliance complexity score                        │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│                    ML MODELS                             │
│                                                          │
│  MODEL 1: Demand Forecasting                            │
│    Algorithm: Prophet + ARIMA ensemble                   │
│    Input: 5-year trade flow data per HS code + country  │
│    Output: Next 12-month demand prediction               │
│    Update: Monthly after COMTRADE refresh                │
│                                                          │
│  MODEL 2: Opportunity Scorer                            │
│    Algorithm: Gradient Boosted Trees (XGBoost)          │
│    Input: Market size, growth rate, India share,        │
│           competition level, tariff rate, buyer count   │
│    Output: Opportunity score 0-100 per market           │
│    Update: Monthly                                      │
│                                                          │
│  MODEL 3: Price Predictor                               │
│    Algorithm: Linear Regression + market adjustments    │
│    Input: Product type, wood, finish, buyer tier,       │
│           origin country, order volume, currency rate   │
│    Output: Recommended FOB range                        │
│    Update: Weekly                                       │
│                                                          │
│  MODEL 4: Trend Detector                                │
│    Algorithm: NLP clustering (TF-IDF + K-Means)        │
│    Input: Retail product titles, descriptions,          │
│           search trends, new product listings           │
│    Output: Emerging trend categories + growth signals   │
│    Update: Weekly                                       │
│                                                          │
│  MODEL 5: Buyer-Supplier Matcher                        │
│    Algorithm: Cosine similarity on feature vectors      │
│    Input: Buyer preferences (wood, finish, price,       │
│           compliance) vs supplier capabilities          │
│    Output: Top 10 matched suppliers per buyer           │
│    Update: Daily                                        │
│                                                          │
│  MODEL 6: Contact Extractor (NER)                       │
│    Algorithm: spaCy NER + custom procurement patterns   │
│    Input: Company web pages, press releases, LinkedIn   │
│    Output: Name, title, department, contact info        │
│    Update: Weekly per target company                    │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│              INFERENCE / OUTPUT LAYER                     │
│                                                          │
│  → API endpoints for frontend consumption               │
│  → Alert generation (new opportunities, compliance)     │
│  → PDF report generation                                │
│  → Email/WhatsApp notifications                         │
│  → Dashboard data refresh                               │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Model Training Data Requirements

| Model | Minimum Records | Current Data | Gap |
|-------|----------------|--------------|-----|
| Demand Forecast | 60+ monthly data points per market | 10 years COMTRADE | Ready |
| Opportunity Scorer | 50+ market-opportunity pairs (labeled) | Need manual labeling | Phase 3 |
| Price Predictor | 500+ price observations | ~100 (buyer FOB data) | Need retail scraping |
| Trend Detector | 1000+ product listings | 0 (no retail scraping yet) | Phase 2 first |
| Buyer-Supplier Match | 30+ buyer profiles + 100+ suppliers | 31 buyers, ~20 suppliers | Partially ready |
| Contact Extractor | 200+ labeled examples | 0 | Phase 3 |

### 2.3 AI Opportunity Finder — Detailed Design

**Input signals combined:**
1. Trade growth: HS 4419 import growth by destination country (COMTRADE)
2. India penetration: India's market share vs China/Vietnam in each market
3. Tariff advantage: Countries where India has 0% or low tariff (GSP+, DCTS)
4. Retail demand: Amazon BSR trends for wooden kitchenware by country
5. Shipment patterns: New buyers appearing in ImportYeti data
6. Price gap: Markets where India FOB is competitive vs current suppliers

**Output format:**
```json
{
  "opportunity_id": "OPP-2026-0047",
  "market": "Germany",
  "product": "Acacia Serving Boards",
  "score": 82,
  "signals": [
    "German imports of HS 4419 grew 14% YoY",
    "India share only 3% vs China 45% — room to grow",
    "EU GSP+ = 0% tariff for Indian wood products",
    "Amazon.de 'acacia board' search volume +28% in 6 months"
  ],
  "recommended_action": "Target Maisons du Monde + Tchibo with acacia serving range at EUR 8-14 FOB",
  "buyer_matches": ["maisons", "tchibo", "jysk"],
  "confidence": 0.78,
  "data_sources": ["COMTRADE 2023", "Amazon.de scrape", "Volza", "WTO tariff"]
}
```

---

## 3. DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│                    PRODUCTION                        │
│                                                      │
│  Frontend (Vercel)                                   │
│    buyeriq.vercel.app                               │
│    React + Vite → CDN → Global edge                 │
│                                                      │
│  Backend API (Railway / Render / AWS)               │
│    api.buyeriq.app                                  │
│    Node.js + Express                                │
│    Auto-scaling, HTTPS                              │
│                                                      │
│  Database (Supabase / Neon / AWS RDS)              │
│    PostgreSQL 15                                    │
│    Connection pooling (PgBouncer)                   │
│    Daily backups                                    │
│                                                      │
│  Cache (Upstash Redis)                             │
│    API response caching                             │
│    Rate limiting                                    │
│    Session storage                                  │
│                                                      │
│  Scraper Workers (Railway / EC2)                    │
│    Python + Playwright                              │
│    Bull queue (Redis-backed)                        │
│    Cron scheduling                                  │
│                                                      │
│  AI/ML (Modal / AWS Lambda)                         │
│    Python + scikit-learn + Prophet                   │
│    Triggered by data pipeline                       │
│    Results written to PostgreSQL                    │
│                                                      │
│  Storage (S3 / Cloudflare R2)                      │
│    Raw scrape data                                  │
│    ML model artifacts                               │
│    Generated PDF reports                            │
└─────────────────────────────────────────────────────┘
```

### Cost Estimate (Monthly)

| Service | Provider | Tier | Est. Cost |
|---------|----------|------|-----------|
| Frontend | Vercel | Free | $0 |
| Backend API | Railway | Starter | $5-20 |
| PostgreSQL | Supabase | Free → Pro | $0-25 |
| Redis | Upstash | Free | $0 |
| Scraper Worker | Railway | Starter | $5-10 |
| Proxy (scraping) | Residential | Basic | $20-50 |
| S3 Storage | Cloudflare R2 | Free tier | $0-5 |
| **Total Phase 2** | | | **$30-110/mo** |

---

## 4. IMPLEMENTATION PRIORITY

### Sprint 1 (Week 1-2): Backend Foundation
- [ ] Set up PostgreSQL (Supabase)
- [ ] Run schema.sql
- [ ] Migrate 31 buyers from BuyerIQ.jsx → database
- [ ] Build REST API skeleton (Express)
- [ ] API: GET /buyers, GET /buyers/:slug, GET /trade-stats

### Sprint 2 (Week 3-4): Live Data
- [ ] ImportYeti API integration (buyer suppliers)
- [ ] UN COMTRADE API client (trade statistics)
- [ ] Currency rate caching in DB
- [ ] Frontend: Switch from hardcoded data to API calls

### Sprint 3 (Week 5-6): Retail Intelligence
- [ ] Amazon scraper (Playwright)
- [ ] Price data pipeline
- [ ] Retail product catalog
- [ ] New tab: Retail Intelligence (trending products, prices)

### Sprint 4 (Week 7-8): AI Layer
- [ ] Demand forecasting model (Prophet)
- [ ] Opportunity scorer
- [ ] Price predictor
- [ ] New tab: AI Opportunities

---

*End of Technical Design Document*
*Next: Implementation begins with Sprint 1*
