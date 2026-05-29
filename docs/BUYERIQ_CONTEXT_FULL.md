# BuyerIQ Development Context — v5.2
**Date:** April 20, 2026
**Project:** BuyerIQ — Senses Lifestyle, Moradabad
**Stack:** React/Vite → Vercel | Node.js → Render | Supabase PostgreSQL
**Repo:** https://github.com/vansham/Buyeriq (private)
**Live:** https://buyeriq.vercel.app | **Backend:** https://buyeriq.onrender.com
**DB State:** 52 buyers, 31 products, 19,806 retail products, 211 shipments, 13 compliance rules

---

## DESIGN SYSTEM
```
bg: #0a0a0a · card: #111111 · border: #1c1c1c
gold: #d4a05a · text: #f0ebe0 · muted: #6b6560
green: #4ade80 · red: #ef4444 · amber: #fbbf24 · blue: #60a5fa
Font: Plus Jakarta Sans · go(id, tab, action) nav pattern
Icons: Lucide only — NO emojis
```

## CLAUDE.md RULES
- Think before coding — verify, don't assume
- Simplicity first — min code that solves problem
- Surgical changes — touch only what's necessary
- Goal-driven — define success criteria first

---

## COMPLETED FIXES (Session Apr 20)

### Buyers Tab (TabBuyers.jsx)
- `localSearch` state added (line 15)
- Search input added (line 586)
- useMemo dependency fixed: `search` → `localSearch` (line 113)
- PR merged via vansham-patch-1 branch ✅

### Dashboard (TabDashboard.jsx)
- Generate Quote button: solid gold color fix
- Critical Alerts: `a.message || a.msg || a.title` fix
- Active Buyers KpiCard: onClick → alerts tab
- Bottom KPI cards: onClick → trade-intel tab
- Confirmed Buyers chips: onClick → buyers tab
- avgFOB fix: filter buyers with valid fob
- Opportunity Signals: "~ AI Estimate" label

### Quote Builder (TabQuoteBuilder.jsx)
- Amazon FR/CA/AU/JP labels and colors added
- Per-platform fallback for wood filter
- Buyer lookup fix: checks `b.dbId === buyerId`
- Compliance "View All" CTA added
- Recent Quotes "Reuse" button added

### Trade Intel (TabTradeIntel.jsx)
- `ratio<30` kept (COMTRADE data issue, not code)
- `slice(0,6)` kept
- Buyer Pitch Action Plan: "View Buyers →" button added
- `go` prop added: `const TabTradeIntel = ({ go, setFilters }) => {`
- Button: `onClick={()=>{ setFilters&&setFilters({country:'US',tier:''}); setTimeout(()=>go&&go(null,'buyers'), 100); }}`
- US filter navigation still not working perfectly — PENDING

### BuyerIQ.jsx
- `<TabTradeIntel go={go} setFilters={setFilters} />` — both props passed

### DB Category Fix (Supabase SQL)
- FR/DE/JP retail products recategorized (~1,000+ rows)
- amazon_fr: 1194 → 630 General Wood Kitchenware
- amazon_de: 1116 → 742

### Cleaner.js Fix
- FR/DE/JP multilingual keywords added to category detection
- German: schneidebrett, hackblock, salatschüssel, löffel etc.
- French: planche, saladier, cuill, ustensile etc.
- Japanese: まな板, ボウル, スプーン etc.

---

## PENDING / KNOWN ISSUES

| Priority | Issue | Notes |
|----------|-------|-------|
| 🔴 | Alibaba cleaner bug | `country_code: 'China' → 'CHN'`. Blocked on Bright Data balance |
| 🟡 | Trade Intel "View Buyers →" US filter | Navigates to buyers tab but filter not applying |
| 🟡 | Competitor Intel — ADF Foods | Shown as Indian competitor but not in DB. Source unknown — needs screenshot to trace |
| 🟡 | Price Intel audit | Not yet done |
| 🟡 | Alerts tab audit | Not yet done |
| 🟡 | Compliance tab audit | Not yet done |
| 🟡 | BUYERIQ_CONTEXT_FULL.md update | docs/ outdated |
| ⚪ | TabTradeIntel refactor | 1,513 lines — split pending |
| ⚪ | Japan scraper coverage | 474 products |

---

## KEY FILES
```
frontend/src/BuyerIQ.jsx
frontend/src/components/tabs/TabQuoteBuilder.jsx
frontend/src/components/tabs/TabBuyers.jsx
frontend/src/components/tabs/TabDashboard.jsx
frontend/src/components/tabs/TabTradeIntel.jsx
frontend/src/components/decision/OpportunityAlerts.jsx
scraping/src/pipeline/cleaner.js
```

## DB TABLES
```
buyers, products, retail_product_data, shipment_records,
trade_statistics, compliance_rules, alerts, quotes,
companies, contacts, suppliers, price_data, currency_rates
```

## TRADE INTEL DATA
- Census Bureau: 9,248 monthly records, Jan 2020 → Feb 2026
- UN COMTRADE: 990 records, 2020-2024
- Total: 10,244 records
- Loading: Render cold start ~60 seconds (free tier)
