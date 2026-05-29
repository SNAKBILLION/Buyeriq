// ─────────────────────────────────────────────
// BuyerIQ — Redis Config (Graceful Fallback)
// ─────────────────────────────────────────────
// If REDIS_URL is set → connect to Upstash/Redis
// If not set → use in-memory cache (no crash)
// ─────────────────────────────────────────────
import { createLogger } from '../utils/logger.js';

const logger = createLogger('redis');
const redisUrl = process.env.REDIS_URL;

let redisConnection = null;
let cacheRedis = null;

// ── Only connect if REDIS_URL exists ─────────
if (redisUrl) {
  try {
    const IORedis = (await import('ioredis')).default;

    const redisConfig = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: {},
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('Redis max retries reached, giving up');
          return null; // stop retrying
        }
        const delay = Math.min(times * 200, 5000);
        logger.warn(`Redis reconnecting, attempt ${times}, delay ${delay}ms`);
        return delay;
      },
    };

    redisConnection = new IORedis(redisUrl, redisConfig);
    cacheRedis = new IORedis(redisUrl, { ...redisConfig, maxRetriesPerRequest: 3 });

    redisConnection.on('connect', () => logger.info('Redis connected'));
    redisConnection.on('error', (err) => logger.error('Redis error', { error: err.message }));
    cacheRedis.on('error', () => {}); // suppress duplicate errors
  } catch (err) {
    logger.warn('Redis import/connect failed, using in-memory fallback', { error: err.message });
  }
} else {
  logger.info('No REDIS_URL — using in-memory cache (no Redis)');
}

// ── In-memory cache fallback ─────────────────
const memoryCache = new Map();

export const cache = {
  async get(key) {
    if (cacheRedis) {
      try {
        const val = await cacheRedis.get(key);
        return val ? JSON.parse(val) : null;
      } catch { return null; }
    }
    // In-memory fallback
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) { memoryCache.delete(key); return null; }
    return entry.value;
  },

  async set(key, value, ttlSeconds = 3600) {
    if (cacheRedis) {
      try {
        await cacheRedis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch { /* fall through to memory */ }
    }
    memoryCache.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
  },

  async del(key) {
    if (cacheRedis) {
      try { await cacheRedis.del(key); return; } catch { /* ignore */ }
    }
    memoryCache.delete(key);
  },

  async exists(key) {
    if (cacheRedis) {
      try { return (await cacheRedis.exists(key)) === 1; } catch { return false; }
    }
    const entry = memoryCache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiry) { memoryCache.delete(key); return false; }
    return true;
  },
};

export async function healthCheck() {
  if (!redisConnection) return { ok: false, error: 'No Redis configured (using in-memory)' };
  try {
    await redisConnection.ping();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export { redisConnection, cacheRedis };
export default { redisConnection, cacheRedis, cache, healthCheck };
