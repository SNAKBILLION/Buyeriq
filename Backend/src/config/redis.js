import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import config from "./index.js";
import { logger } from "./logger.js";

let connection = null;
let redisAvailable = true;

export function getRedis() {
  if (!connection) {
    try {
      connection = new IORedis(config.redis.url, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            redisAvailable = false;
            return null; // Stop retrying
          }
          return Math.min(times * 200, 2000);
        },
      });
      connection.on("error", (err) => {
        redisAvailable = false;
        logger.warn(`Redis unavailable: ${err.message.substring(0, 80)}`);
      });
      connection.on("connect", () => {
        redisAvailable = true;
        logger.info("Redis connected (BullMQ)");
      });
    } catch (err) {
      redisAvailable = false;
      logger.warn(`Redis init failed: ${err.message}`);
    }
  }
  return connection;
}

export function isRedisAvailable() {
  return redisAvailable;
}

// Job queue factory — returns null if Redis unavailable
export function createQueue(name) {
  try {
    return new Queue(name, { connection: getRedis() });
  } catch (err) {
    logger.warn(`Queue ${name} not created: ${err.message}`);
    return null;
  }
}

export function createWorker(name, processor, opts = {}) {
  try {
    const worker = new Worker(name, processor, {
      connection: getRedis(),
      concurrency: opts.concurrency || 3,
      ...opts,
    });
    worker.on("completed", (job) => logger.info(`Job ${name}:${job.id} completed`));
    worker.on("failed", (job, err) => logger.warn(`Job ${name}:${job?.id} failed: ${err.message.substring(0,80)}`));
    worker.on("error", (err) => logger.warn(`Worker ${name} error: ${err.message.substring(0,80)}`));
    return worker;
  } catch (err) {
    logger.warn(`Worker ${name} not created: ${err.message}`);
    return null;
  }
}

// Pre-defined queues
export const QUEUES = {
  CURRENCY_FETCH: "currency-fetch",
  RETAIL_SCRAPE: "retail-scrape",
  SHIPMENT_IMPORT: "shipment-import",
  TRADE_UPDATE: "trade-update",
  BUYER_DISCOVERY: "buyer-discovery",
  SUPPLIER_SCAN: "supplier-scan",
};
