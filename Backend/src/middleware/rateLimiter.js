// ─────────────────────────────────────────────
// BuyerIQ — Rate Limiting Middleware
// ─────────────────────────────────────────────
// Tiered rate limiting:
//   apiLimiter    → all routes (100 req / 15 min)
//   authLimiter   → login/register (20 req / 15 min)
//   writeLimiter  → POST/PUT/DELETE (30 req / 15 min)
//   strictLimiter → sensitive admin ops (10 req / 15 min)
// ─────────────────────────────────────────────
import rateLimit from "express-rate-limit";
import config from "../config/index.js";

// ── General API limiter (all routes) ──
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many requests, please try again later" } },
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.path.includes('/health'),
});

// ── Auth limiter (login/register — strict) ──
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many auth attempts, try again in 15 minutes" } },
  keyGenerator: (req) => req.body?.email || req.ip,
});

// ── Write limiter (POST/PUT/DELETE — stricter than reads) ──
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many write operations, try again later" } },
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
});

// ── Strict limiter (admin-only operations — very tight) ──
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Rate limit exceeded for sensitive operations" } },
  keyGenerator: (req) => req.user?.id || req.ip,
});
