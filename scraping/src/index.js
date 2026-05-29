#!/usr/bin/env node
import 'dotenv/config';
import express from 'express';
import { createLogger } from './utils/logger.js';
import { healthCheck as dbHealth } from './config/database.js';
import { startScheduler, stopScheduler, listSchedules } from './scheduler/cron.js';
import { createAPIServer } from './api/intelligence-api.js';

const log  = createLogger('main');
const PORT = parseInt(process.env.PORT || '4000', 10);

const ALLOWED_ORIGINS = [
  'https://buyeriq.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function setCORS(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

async function boot() {
  log.info('══════════════════════════════════════');
  log.info('  BuyerIQ Data Ingestion Engine');
  log.info('  Mode: scheduler (direct — no Redis)');
  log.info('══════════════════════════════════════');

  const db = await dbHealth();
  if (!db.ok) {
    log.error('PostgreSQL not available', { error: db.error });
    process.exit(1);
  }
  log.info(`✓ PostgreSQL connected (${db.time})`);

  startScheduler();
  log.info('✓ Scheduler started');

  const mainApp = express();

  mainApp.use((req, res, next) => {
    setCORS(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    next();
  });

  mainApp.get(['/', '/health'], (req, res) => {
    res.json({
      status: 'ok',
      service: 'buyeriq-scraping',
      mode: 'direct-cron',
      schedules: listSchedules(),
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  const { app: intelApp } = createAPIServer();
  mainApp.use('/', intelApp);

  mainApp.listen(PORT, () => {
    log.info(`✓ Server on port ${PORT} (health + intelligence API)`);
  });
}

process.on('SIGINT',  () => { stopScheduler(); process.exit(0); });
process.on('SIGTERM', () => { stopScheduler(); process.exit(0); });
process.on('unhandledRejection', (err) => {
  log.error('Unhandled rejection', { error: err.message });
});
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception', { error: err.message });
  process.exit(1);
});

boot().catch((err) => {
  log.error('Boot failed', { error: err.message });
  process.exit(1);
});
