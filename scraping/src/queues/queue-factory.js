// ─────────────────────────────────────────────
// BuyerIQ — Queue Factory (BullMQ)
// ─────────────────────────────────────────────
// Creates all job queues with retry, backoff,
// rate limiting, and failure handling.
// ─────────────────────────────────────────────
import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { QUEUES } from '../config/constants.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('queues');

// ── Default job options applied to every queue ──
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,  // 5s → 10s → 20s
  },
  removeOnComplete: {
    age: 86400,   // Keep completed jobs 24h
    count: 500,   // Keep max 500 completed
  },
  removeOnFail: {
    age: 604800,  // Keep failed jobs 7 days
  },
};

// ── Per-queue configuration overrides ────────
const QUEUE_CONFIGS = {
  [QUEUES.TRADE_DATA]: {
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 5,
      backoff: { type: 'exponential', delay: 10000 },
      // Trade data is critical — more retries, longer backoff
    },
  },
  [QUEUES.SHIPMENT]: {
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 3,
    },
  },
  [QUEUES.MARKETPLACE]: {
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 2,
      // Scraping is flaky — fewer retries, move on
    },
  },
  [QUEUES.SUPPLIER]: {
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 2,
    },
  },
  [QUEUES.BUYER_DISCOVERY]: {
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 3,
    },
  },
  [QUEUES.CURRENCY]: {
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 5,
      backoff: { type: 'fixed', delay: 30000 },
      // Currency is simple API — retry aggressively
    },
  },
};

// ── Queue registry ───────────────────────────
const queues = new Map();
const queueEvents = new Map();

/**
 * Get or create a queue by name
 */
export function getQueue(name) {
  if (queues.has(name)) return queues.get(name);

  const config = QUEUE_CONFIGS[name] || { defaultJobOptions: DEFAULT_JOB_OPTIONS };

  const queue = new Queue(name, {
    connection: redisConnection,
    defaultJobOptions: config.defaultJobOptions,
  });

  queues.set(name, queue);
  log.info(`Queue created: ${name}`);
  return queue;
}

/**
 * Get queue events listener for monitoring
 */
export function getQueueEvents(name) {
  if (queueEvents.has(name)) return queueEvents.get(name);

  const events = new QueueEvents(name, { connection: redisConnection });

  events.on('completed', ({ jobId, returnvalue }) => {
    log.debug(`Job completed: ${name}/${jobId}`);
  });

  events.on('failed', ({ jobId, failedReason }) => {
    log.error(`Job failed: ${name}/${jobId}`, { reason: failedReason });
  });

  events.on('stalled', ({ jobId }) => {
    log.warn(`Job stalled: ${name}/${jobId}`);
  });

  queueEvents.set(name, events);
  return events;
}

/**
 * Add a job to a named queue
 *
 * @param {string} queueName - Queue name from QUEUES constant
 * @param {string} jobType - Job type identifier
 * @param {object} data - Job payload
 * @param {object} opts - BullMQ job options override
 * @returns {object} The created job
 */
export async function addJob(queueName, jobType, data, opts = {}) {
  const queue = getQueue(queueName);

  const job = await queue.add(jobType, {
    ...data,
    _jobType: jobType,
    _enqueuedAt: new Date().toISOString(),
  }, {
    ...opts,
    jobId: opts.jobId || `${jobType}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
  });

  log.info(`Job added: ${queueName}/${jobType}`, { jobId: job.id });
  return job;
}

/**
 * Add a repeatable (scheduled) job to a queue
 */
export async function addRepeatableJob(queueName, jobType, data, pattern, opts = {}) {
  const queue = getQueue(queueName);

  const job = await queue.add(jobType, {
    ...data,
    _jobType: jobType,
    _repeatable: true,
  }, {
    ...opts,
    repeat: { pattern },  // cron pattern
    jobId: opts.jobId || `repeat:${jobType}`,
  });

  log.info(`Repeatable job added: ${queueName}/${jobType}`, { pattern });
  return job;
}

/**
 * Get stats across all queues
 */
export async function getAllQueueStats() {
  const stats = {};

  for (const [name, queue] of queues) {
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    stats[name] = counts;
  }

  return stats;
}

/**
 * Drain and clean all queues (for dev/testing)
 */
export async function drainAllQueues() {
  for (const [name, queue] of queues) {
    await queue.drain();
    log.warn(`Queue drained: ${name}`);
  }
}

/**
 * Close all queues gracefully
 */
export async function closeAllQueues() {
  for (const [, queue] of queues) await queue.close();
  for (const [, events] of queueEvents) await events.close();
  queues.clear();
  queueEvents.clear();
  log.info('All queues closed');
}

/**
 * Initialize all queues at startup
 */
export function initializeQueues() {
  Object.values(QUEUES).forEach((name) => {
    getQueue(name);
    getQueueEvents(name);
  });
  log.info(`Initialized ${queues.size} queues`);
}

export default {
  getQueue, getQueueEvents, addJob, addRepeatableJob,
  getAllQueueStats, drainAllQueues, closeAllQueues, initializeQueues,
};
