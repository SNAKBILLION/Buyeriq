# BuyerIQ — Data Collection & Scraping Infrastructure

Production-grade data ingestion pipeline for the BuyerIQ global exporter intelligence platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SCHEDULER (node-cron)                    │
│  Currency→hourly  Marketplace→hourly  Shipments→daily       │
│  Buyers→daily     Suppliers→daily     Trade data→monthly    │
└─────────────────────────┬───────────────────────────────────┘
                          │ enqueue jobs
┌─────────────────────────▼───────────────────────────────────┐
│                   BULLMQ QUEUES (Redis)                      │
│  trade_data_ingestion_queue    shipment_scraper_queue        │
│  marketplace_scraper_queue     supplier_scraper_queue        │
│  buyer_discovery_queue                                       │
│  Features: retry, exponential backoff, rate limiting         │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────┘
       │          │          │          │          │
┌──────▼───┐ ┌───▼─────┐ ┌──▼──────┐ ┌▼────────┐ ┌▼────────┐
│ Trade    │ │Shipment │ │Market-  │ │Supplier │ │Buyer    │
│ Worker   │ │ Worker  │ │place    │ │ Worker  │ │Discovery│
│          │ │         │ │ Worker  │ │         │ │ Worker  │
│COMTRADE  │ │ImportYeti│ │Amazon  │ │Alibaba  │ │ImportYeti│
│Frankfurter│ │         │ │Walmart │ │IndiaMART│ │Enrichment│
└──────┬───┘ └───┬─────┘ └──┬──────┘ └┬────────┘ └┬────────┘
       │         │          │         │           │
       └─────────┴──────────┴────┬────┴───────────┘
                                 │
┌────────────────────────────────▼────────────────────────────┐
│                     DATA PIPELINE                            │
│  1. Raw JSON Storage (./raw-data/{source}/{date}/)          │
│  2. Cleaner (dedup, normalize, validate, confidence score)  │
│  3. PostgreSQL Inserter (upsert with conflict handling)     │
└─────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────┐
│                    POSTGRESQL TABLES                         │
│  trade_statistics • shipment_records • retail_product_data  │
│  suppliers • companies • price_data                         │
│  scraper_jobs • scraper_logs • scraper_metrics              │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 14
- **Redis** >= 6
- **Playwright** browsers (installed via `npx playwright install chromium`)

## Setup

```bash
# 1. Install dependencies
cd buyeriq-scraping
npm install

# 2. Install Playwright browser
npx playwright install chromium

# 3. Configure environment
cp .env.example .env
# Edit .env with your database, Redis, and API credentials

# 4. Run monitoring table migration
node scripts/migrate.js
```

## Running

### Full System (workers + scheduler)
```bash
npm start
# or
node src/index.js
```

### Workers Only (no scheduler, enqueue jobs manually)
```bash
node src/index.js --workers-only
```

### Scheduler Only (requires workers running elsewhere)
```bash
node src/index.js --scheduler-only
```

### Individual Workers
```bash
npm run worker:trade
npm run worker:shipment
npm run worker:marketplace
npm run worker:supplier
npm run worker:buyer
```

### Seed Initial Jobs
```bash
node scripts/seed-queues.js
```

### Test Individual Connectors
```bash
node scripts/test-connector.js comtrade
node scripts/test-connector.js frankfurter
node scripts/test-connector.js amazon
node scripts/test-connector.js walmart
node scripts/test-connector.js importyeti
node scripts/test-connector.js alibaba
```

## Folder Structure

```
buyeriq-scraping/
├── src/
│   ├── index.js                    # Main entry point
│   ├── config/
│   │   ├── constants.js            # HS codes, queues, rate limits
│   │   ├── database.js             # PostgreSQL pool + helpers
│   │   └── redis.js                # Redis connection + cache
│   ├── connectors/
│   │   ├── api/
│   │   │   ├── base-api.connector.js    # Shared: retry, cache, rate limit
│   │   │   ├── comtrade.connector.js    # UN COMTRADE trade data
│   │   │   └── frankfurter.connector.js # Live FX rates
│   │   └── scrapers/
│   │       ├── base.scraper.js          # Shared: Playwright, anti-detect
│   │       ├── amazon.scraper.js        # Amazon product search
│   │       ├── walmart.scraper.js       # Walmart product search
│   │       ├── importyeti.scraper.js    # US customs shipment data
│   │       └── alibaba.scraper.js       # Supplier discovery
│   ├── queues/
│   │   └── queue-factory.js        # BullMQ queue creation + management
│   ├── workers/
│   │   ├── trade-data.worker.js    # COMTRADE + currency jobs
│   │   ├── shipment.worker.js      # ImportYeti shipment jobs
│   │   ├── marketplace.worker.js   # Amazon + Walmart jobs
│   │   ├── supplier.worker.js      # Alibaba supplier jobs
│   │   └── buyer-discovery.worker.js# Buyer lead discovery jobs
│   ├── pipeline/
│   │   ├── raw-storage.js          # JSON raw data layer
│   │   ├── cleaner.js              # Data cleaning + dedup
│   │   └── db-inserter.js          # PostgreSQL upserts
│   ├── scheduler/
│   │   └── cron.js                 # Automated job scheduling
│   ├── monitoring/
│   │   └── job-tracker.js          # Job metrics + failed job tracking
│   └── utils/
│       ├── logger.js               # Winston structured logging
│       ├── rate-limiter.js         # Redis sliding window limiter
│       ├── user-agents.js          # UA rotation
│       └── proxy-manager.js        # Proxy rotation support
├── scripts/
│   ├── seed-queues.js              # Initial job seeding
│   ├── test-connector.js           # Connector smoke tests
│   └── migrate.js                  # Monitoring table migration
├── raw-data/                       # Raw JSON storage (gitignored)
│   ├── trade/
│   ├── shipments/
│   ├── marketplace/
│   ├── suppliers/
│   └── buyers/
├── logs/                           # Log files (gitignored)
├── package.json
├── .env.example
└── README.md
```

## Data Sources

| Source | Type | Method | Schedule |
|--------|------|--------|----------|
| UN COMTRADE | Trade flows | REST API | Monthly |
| Frankfurter | Currency rates | REST API | Hourly |
| ImportYeti | Shipment data | Playwright | Daily |
| Amazon | Retail prices | Playwright | Hourly |
| Walmart | Retail prices | Playwright | Hourly |
| Alibaba | Supplier data | Playwright | Daily |

## Scraping Safety

- Redis-backed sliding window rate limiter per source
- Random delays between requests (2-8 seconds)
- User agent rotation (11 browser profiles)
- Proxy rotation support (static list or rotating service)
- Playwright anti-detection (webdriver override, stealth scripts)
- Resource blocking (images, fonts, CSS) for speed
- Exponential backoff on failures
- Concurrency limits per worker (1 for scrapers, 2 for APIs)

## Monitoring

Jobs are tracked in `scraper_jobs` table with:
- Status (completed/failed), runtime, retry count
- Records raw → cleaned → inserted counts
- Error messages for failed jobs
- Daily aggregated metrics in `scraper_metrics`

Query examples:
```sql
-- Last 24h job summary
SELECT queue_name, status, COUNT(*), AVG(runtime_ms)::int
FROM scraper_jobs WHERE created_at > NOW() - INTERVAL '24h'
GROUP BY queue_name, status;

-- Recent failures
SELECT job_type, error_message, created_at
FROM scraper_jobs WHERE status = 'failed'
ORDER BY created_at DESC LIMIT 10;
```
