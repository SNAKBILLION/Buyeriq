# BuyerIQ — Enterprise Backend API

**Senses Lifestyle · Moradabad, India**
Buyer Intelligence Platform for Wooden Kitchenware Exporters

## Architecture

```
buyeriq-backend/
│
├── package.json                    # Dependencies & scripts
├── .env.example                    # Environment variable template
├── .gitignore
│
├── database/
│   ├── migrate.js                  # Migration runner with tracking
│   ├── migrations/
│   │   └── 001_initial_schema.sql  # 15 core tables + views + indexes
│   └── seeds/
│       └── seed.js                 # Initial data (countries, compliance, products)
│
└── src/
    ├── index.js                    # Entry point — starts server + DB + jobs
    ├── app.js                      # Express app — middleware chain + route mounting
    │
    ├── config/
    │   ├── index.js                # Centralized env config (db, redis, jwt, apis)
    │   ├── database.js             # PostgreSQL pool + query helper + transactions
    │   ├── logger.js               # Winston logger (console + file)
    │   └── redis.js                # BullMQ queues + workers for background jobs
    │
    ├── middleware/
    │   ├── auth.js                 # JWT authenticate + authorize + optionalAuth
    │   ├── validate.js             # Joi schema validation (body/query/params)
    │   ├── errorHandler.js         # Global error handler + 404 handler
    │   └── rateLimiter.js          # Rate limiting (100/15min API, 20/15min auth)
    │
    ├── utils/
    │   ├── ApiError.js             # Custom error class with HTTP status codes
    │   ├── asyncHandler.js         # Catches async errors in route handlers
    │   ├── pagination.js           # Parse page/limit/sort + format response
    │   ├── queryBuilder.js         # Dynamic SQL WHERE builder (ILIKE, IN, ANY)
    │   └── BaseRepository.js       # CRUD base class — all modules inherit this
    │
    ├── modules/                    # Feature modules (each: router/controller/service/validation)
    │   ├── health/                 # GET /health — DB connection + uptime
    │   ├── buyers/                 # Buyer profiles (31 current, slug-based lookup)
    │   ├── suppliers/              # Supplier directory (Moradabad, Saharanpur, global)
    │   ├── products/               # Product catalog (10 items, HS-linked)
    │   ├── contacts/               # Procurement decision-makers
    │   ├── hs-codes/               # Harmonized System code data
    │   ├── shipments/              # Bill of Lading records (ImportYeti)
    │   ├── trade-stats/            # Annual trade flow aggregates (COMTRADE)
    │   ├── prices/                 # Multi-source price intelligence
    │   ├── retail/                 # Marketplace product listings (Amazon, etc.)
    │   ├── compliance/             # 9 compliance laws (Lacey Act, EUDR, etc.)
    │   ├── alerts/                 # System alerts & notifications
    │   ├── quotes/                 # Export quote generator
    │   └── users/                  # Auth (register/login/JWT) + role-based access
    │
    ├── jobs/                       # Background job processors
    │   ├── index.js                # Job scheduler initialization
    │   └── currencyJob.js          # Live FX rate fetcher (Frankfurter API)
    │
    └── services/                   # Shared business logic (future: AI pipeline)
```

## Quick Start

```bash
# 1. Clone & install
git clone <repo-url>
cd buyeriq-backend
cp .env.example .env     # Edit DATABASE_URL
npm install

# 2. Database setup (PostgreSQL 15+)
createdb buyeriq
npm run migrate           # Runs 001_initial_schema.sql
npm run seed              # Inserts countries, compliance, products, admin user

# 3. Start server
npm run dev               # Development (auto-reload)
npm start                 # Production
```

Server starts at `http://localhost:4000`

## API Endpoints

Base URL: `/api/v1`

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/users/register` | Create account | No |
| POST | `/users/login` | Get JWT token | No |
| GET | `/users/me` | Current user profile | Bearer |
| GET | `/users` | List all users | Admin |

### Buyers
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/buyers` | List buyers (paginated, filterable) | Optional |
| GET | `/buyers/:id` | Get buyer by UUID or slug | Optional |
| POST | `/buyers` | Create buyer | Bearer |
| PUT | `/buyers/:id` | Update buyer | Bearer |
| DELETE | `/buyers/:id` | Delete buyer | Bearer |

**Query params:** `?search=TJX&tier=mega_volume&country_code=US&page=1&limit=25&sort_by=name&sort_order=asc`

### All Resource Endpoints (Same CRUD Pattern)
| Resource | Endpoint | Filter Fields |
|----------|----------|---------------|
| Suppliers | `/suppliers` | country_code, cluster, is_active, is_competitor |
| Products | `/products` | hs_code, category |
| Contacts | `/contacts` | company_id, buyer_id, supplier_id |
| HS Codes | `/hs-codes` | chapter |
| Shipments | `/shipments` | buyer_id, supplier_id, hs_code, origin_country, dest_country |
| Trade Stats | `/trade-stats` | reporter_country, partner_country, hs_code, year, flow |
| Prices | `/prices` | product_id, source_name, price_type, marketplace |
| Retail | `/retail` | marketplace, category, material, wood_type |
| Compliance | `/compliance` | country_scope, status |
| Alerts | `/alerts` | buyer_id, type, urgency, status |
| Quotes | `/quotes` | buyer_id, product_id, status |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | DB status, uptime, pool stats |

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 31,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "\"email\" must be a valid email" }
    ]
  }
}
```

## Architecture Decisions

### BaseRepository Pattern
All 13 data modules extend `BaseRepository` which provides standard CRUD operations. Module-specific logic goes in the service layer. This means adding a new table requires only 4 files (~60 lines total) instead of rewriting boilerplate.

### QueryBuilder
Dynamic SQL filter construction with parameterized queries. Supports `=`, `ILIKE` (text search), `IN` (multi-value), and `ANY` (array fields). Prevents SQL injection by using `$N` placeholders.

### Background Jobs (BullMQ + Redis)
Job queues are pre-configured for 7 job types: currency fetch, retail scraping, shipment import, trade updates, buyer discovery, supplier scanning, and AI pipeline. Currently only currency fetcher runs. Workers can be added by creating job files in `src/jobs/`.

### Security
- JWT auth with role-based access (admin, manager, sales, production, viewer)
- Helmet security headers
- Rate limiting (100 req/15min general, 20/15min for auth)
- Joi input validation on all endpoints
- CORS restricted to frontend origins
- SSRF protection on external API calls (URL allowlisting)
- bcrypt password hashing (cost factor 12)

## Database

PostgreSQL 15+ with 15 core tables, 3 junction tables, 3 operational tables, and 3 views. Full schema in `database/migrations/001_initial_schema.sql`.

Key design choices:
- UUID primary keys (no sequential ID exposure)
- `confidence_level` enum on all data tables (verified/industry_estimate/unverified)
- `pg_trgm` extension for fuzzy text search
- `data_audit_log` table for change tracking
- `scraper_jobs` table for pipeline monitoring
- Composite unique constraints on trade statistics

## Deployment

```bash
# Build for production
NODE_ENV=production npm start

# Recommended: Railway, Render, or Fly.io
# Database: Supabase (free tier) or Neon
# Redis: Upstash (free tier)
```

---

*BuyerIQ v4.0 → Enterprise · Senses Lifestyle, Moradabad*
