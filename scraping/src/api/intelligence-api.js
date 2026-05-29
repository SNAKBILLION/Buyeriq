// ─────────────────────────────────────────────
// BuyerIQ — Intelligence API Server (Express)
// ─────────────────────────────────────────────
// Exposes AI intelligence through REST endpoints:
//   /api/intelligence/buyers
//   /api/intelligence/opportunities
//   /api/intelligence/demand
//   /api/intelligence/insights
//   /api/intelligence/shipments
//   /api/intelligence/health
//   /api/intelligence/run
// ─────────────────────────────────────────────
import express from 'express';
import { createLogger } from '../utils/logger.js';
import {
  runFullAnalysis, initAIEngine, getAIHealthSnapshot,
  getBuyerSignals, getBuyerSignalStats,
  getShipmentTrends,
  getDemandTrends,
  getOpportunities,
  getInsights, markInsightRead, getInsightStats,
} from '../ai-engine/index.js';
import { calculateMarginPotential, getPriceIntelligenceSummary } from '../intelligence/price-intelligence.js';

const log = createLogger('api');

export function createAPIServer(port = 4000) {
  const app = express();
  app.use(express.json());

  // ── CORS ───────────────────────────────
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // ── Auth Middleware ──────────────────────
  const INTEL_API_KEY = process.env.INTEL_API_KEY || null;

  function requireAuth(req, res, next) {
    // Skip auth for health endpoint
    if (req.path === '/api/intelligence/health') return next();

    // Check API key
    const apiKey = req.headers['x-api-key'];
    if (INTEL_API_KEY && apiKey === INTEL_API_KEY) return next();

    // Check Bearer token (forwarded from frontend via backend)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) return next();

    // In development, allow unauthenticated ONLY if explicitly opted in
    if (!INTEL_API_KEY && process.env.INTEL_AUTH_SKIP === 'true') return next();

    res.status(401).json({ success: false, error: 'Authentication required. Set INTEL_API_KEY or pass Bearer token.' });
  }

  app.use(requireAuth);

  // ── Error wrapper ──────────────────────
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // ══════════════════════════════════════════
  // BUYER INTELLIGENCE
  // ══════════════════════════════════════════

  // GET /api/intelligence/buyers
  app.get('/api/intelligence/buyers', wrap(async (req, res) => {
    const { limit = 50, min_score = 0, country, wood_only, signal_type } = req.query;
    const buyers = await getBuyerSignals({
      limit: parseInt(limit, 10),
      minScore: parseInt(min_score, 10),
      country,
      woodOnly: wood_only === 'true',
      signalType: signal_type,
    });
    res.json({ success: true, count: buyers.length, data: buyers });
  }));

  // GET /api/intelligence/buyers/stats
  app.get('/api/intelligence/buyers/stats', wrap(async (req, res) => {
    const stats = await getBuyerSignalStats();
    res.json({ success: true, data: stats });
  }));

  // ══════════════════════════════════════════
  // MARKET OPPORTUNITIES
  // ══════════════════════════════════════════

  // GET /api/intelligence/opportunities
  app.get('/api/intelligence/opportunities', wrap(async (req, res) => {
    const { limit = 30, min_score = 0, type, country } = req.query;
    const opps = await getOpportunities({
      limit: parseInt(limit, 10),
      minScore: parseInt(min_score, 10),
      type,
      country,
    });
    res.json({ success: true, count: opps.length, data: opps });
  }));

  // ══════════════════════════════════════════
  // DEMAND TRENDS
  // ══════════════════════════════════════════

  // GET /api/intelligence/demand
  app.get('/api/intelligence/demand', wrap(async (req, res) => {
    const { limit = 30, min_score = 0, trend, country } = req.query;
    const trends = await getDemandTrends({
      limit: parseInt(limit, 10),
      minScore: parseInt(min_score, 10),
      trend,
      country,
    });
    res.json({ success: true, count: trends.length, data: trends });
  }));

  // ══════════════════════════════════════════
  // INTELLIGENCE REPORTS (INSIGHTS)
  // ══════════════════════════════════════════

  // GET /api/intelligence/insights
  app.get('/api/intelligence/insights', wrap(async (req, res) => {
    const { limit = 30, type, severity, category, unread_only } = req.query;
    const insights = await getInsights({
      limit: parseInt(limit, 10),
      type,
      severity,
      category,
      unreadOnly: unread_only === 'true',
    });
    res.json({ success: true, count: insights.length, data: insights });
  }));

  // PATCH /api/intelligence/insights/:id/read
  app.patch('/api/intelligence/insights/:id/read', wrap(async (req, res) => {
    await markInsightRead(parseInt(req.params.id, 10));
    res.json({ success: true });
  }));

  // GET /api/intelligence/insights/stats
  app.get('/api/intelligence/insights/stats', wrap(async (req, res) => {
    const stats = await getInsightStats();
    res.json({ success: true, data: stats });
  }));

  // ══════════════════════════════════════════
  // SHIPMENT TRENDS
  // ══════════════════════════════════════════

  // GET /api/intelligence/shipments/trends
  app.get('/api/intelligence/shipments/trends', wrap(async (req, res) => {
    const { country, months = 12 } = req.query;
    const trends = await getShipmentTrends({ country, months: parseInt(months, 10) });
    res.json({ success: true, count: trends.length, data: trends });
  }));

  // ══════════════════════════════════════════
  // PRICE INTELLIGENCE
  // ══════════════════════════════════════════

  // GET /api/intelligence/prices — full margin analysis
  app.get('/api/intelligence/prices', wrap(async (req, res) => {
    const { category, platform } = req.query;
    const margins = await calculateMarginPotential(category || null, platform || null);
    res.json({ success: true, count: margins.length, data: margins });
  }));

  // GET /api/intelligence/prices/summary — compact dashboard
  app.get('/api/intelligence/prices/summary', wrap(async (req, res) => {
    const summary = await getPriceIntelligenceSummary();
    res.json({ success: true, data: summary });
  }));

  // ══════════════════════════════════════════
  // ENGINE CONTROL
  // ══════════════════════════════════════════

  // POST /api/intelligence/run — trigger full analysis
  app.post('/api/intelligence/run', wrap(async (req, res) => {
    const options = req.body || {};
    log.info('Manual AI analysis triggered', options);
    const results = await runFullAnalysis(options);
    res.json({ success: true, data: results });
  }));

  // GET /api/intelligence/health
  app.get('/api/intelligence/health', wrap(async (req, res) => {
    const snapshot = await getAIHealthSnapshot();
    res.json({ success: true, data: snapshot });
  }));

  // ══════════════════════════════════════════
  // ERROR HANDLER
  // ══════════════════════════════════════════

  app.use((err, req, res, _next) => {
    log.error(`API Error: ${req.method} ${req.path}`, { error: err.message });
    res.status(500).json({
      success: false,
      error: err.message,
      path: req.path,
    });
  });

  // ── Start ──────────────────────────────
  return {
    app,
    start() {
      return new Promise((resolve) => {
        const server = app.listen(port, () => {
          log.info(`Intelligence API running on http://localhost:${port}`);
          log.info('Endpoints:');
          log.info('  GET  /api/intelligence/buyers');
          log.info('  GET  /api/intelligence/buyers/stats');
          log.info('  GET  /api/intelligence/opportunities');
          log.info('  GET  /api/intelligence/demand');
          log.info('  GET  /api/intelligence/insights');
          log.info('  GET  /api/intelligence/insights/stats');
          log.info('  PATCH /api/intelligence/insights/:id/read');
          log.info('  GET  /api/intelligence/shipments/trends');
          log.info('  GET  /api/intelligence/prices');
          log.info('  GET  /api/intelligence/prices/summary');
          log.info('  POST /api/intelligence/run');
          log.info('  GET  /api/intelligence/health');
          resolve(server);
        });
      });
    },
  };
}

export default { createAPIServer };
