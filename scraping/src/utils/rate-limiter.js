// ─────────────────────────────────────────────
// BuyerIQ — Rate Limiter (Redis + In-Memory Fallback)
// ─────────────────────────────────────────────
import { cacheRedis } from '../config/redis.js';
import { RATE_LIMITS } from '../config/constants.js';
import { createLogger } from './logger.js';

const log = createLogger('rate-limiter');

// ── In-memory rate limit tracking (fallback) ──
const memoryWindows = new Map();

/**
 * In-memory rate limit check (no Redis needed)
 */
function checkRateLimitMemory(source, limits) {
  const now = Date.now();
  const key = `ratelimit:${source}`;
  
  if (!memoryWindows.has(key)) {
    memoryWindows.set(key, []);
  }

  const window = memoryWindows.get(key);
  
  // Remove expired entries
  const windowStart = now - limits.windowMs;
  while (window.length > 0 && window[0] < windowStart) {
    window.shift();
  }

  if (window.length >= limits.requests) {
    const retryAfterMs = window[0] + limits.windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  window.push(now);
  return { allowed: true, remaining: limits.requests - window.length, retryAfterMs: 0 };
}

/**
 * Redis-backed rate limit check (sliding window)
 */
async function checkRateLimitRedis(source, limits) {
  const key = `ratelimit:${source}`;
  const now = Date.now();
  const windowStart = now - limits.windowMs;

  const pipeline = cacheRedis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zcard(key);
  pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
  pipeline.pexpire(key, limits.windowMs);

  const results = await pipeline.exec();
  const currentCount = results[1][1];

  if (currentCount >= limits.requests) {
    const oldest = await cacheRedis.zrange(key, 0, 0, 'WITHSCORES');
    const retryAfterMs = oldest.length >= 2
      ? parseInt(oldest[1], 10) + limits.windowMs - now
      : limits.windowMs;

    log.warn(`Rate limit hit for ${source}`, { current: currentCount, limit: limits.requests });
    await cacheRedis.zremrangebyscore(key, now, now + 1);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { allowed: true, remaining: limits.requests - currentCount - 1, retryAfterMs: 0 };
}

/**
 * Check rate limit — uses Redis if available, else in-memory
 */
export async function checkRateLimit(source, config = null) {
  const limits = config || RATE_LIMITS[source] || RATE_LIMITS.DEFAULT;

  if (cacheRedis) {
    try {
      return await checkRateLimitRedis(source, limits);
    } catch (err) {
      log.warn(`Redis rate limit failed, using memory: ${err.message}`);
    }
  }

  return checkRateLimitMemory(source, limits);
}

/**
 * Wait until rate limit allows, then proceed.
 */
export async function waitForRateLimit(source, config = null) {
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    const result = await checkRateLimit(source, config);
    if (result.allowed) return result;

    attempt++;
    const waitMs = Math.min(result.retryAfterMs, 60000);
    log.info(`Rate limit: waiting ${waitMs}ms for ${source} (attempt ${attempt})`);
    await sleep(waitMs);
  }

  // Don't throw — just allow after max attempts (better than crashing)
  log.warn(`Rate limit: max attempts reached for ${source}, allowing anyway`);
  return { allowed: true, remaining: 0, retryAfterMs: 0 };
}

/**
 * Add random delay between requests (anti-detection)
 */
export async function randomDelay(minMs = 2000, maxMs = 8000) {
  const delay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
  await sleep(delay);
  return delay;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default { checkRateLimit, waitForRateLimit, randomDelay };
