// ─────────────────────────────────────────────
// BuyerIQ — Raw Data Storage Layer
// ─────────────────────────────────────────────
// Saves raw scraped/fetched data as JSON before cleaning.
// Enables replay, debugging, and audit trail.
// ─────────────────────────────────────────────
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../utils/logger.js';

const log = createLogger('raw-storage');
const RAW_DIR = process.env.RAW_DATA_DIR || './raw-data';

/**
 * Save raw data to disk organized by source/date
 *
 * @param {string} source - e.g., 'trade', 'shipments', 'marketplace'
 * @param {string} subType - e.g., 'comtrade', 'amazon', 'importyeti'
 * @param {object} data - Raw data to store
 * @param {object} meta - Job metadata (jobId, query, etc.)
 * @returns {string} Path to saved file
 */
export async function saveRaw(source, subType, data, meta = {}) {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const timestamp = Date.now();
  const dir = path.join(RAW_DIR, source, subType, date);

  await fs.mkdir(dir, { recursive: true });

  const filename = `${timestamp}_${meta.jobId || 'manual'}.json`;
  const filepath = path.join(dir, filename);

  const envelope = {
    _meta: {
      source,
      subType,
      jobId: meta.jobId || null,
      query: meta.query || null,
      collectedAt: new Date().toISOString(),
      recordCount: Array.isArray(data) ? data.length : 1,
    },
    data,
  };

  await fs.writeFile(filepath, JSON.stringify(envelope, null, 2));
  log.debug(`Raw data saved: ${filepath}`, { records: envelope._meta.recordCount });

  return filepath;
}

/**
 * Read a raw data file
 */
export async function readRaw(filepath) {
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * List raw files for a source/date range
 */
export async function listRawFiles(source, subType, dateFrom, dateTo) {
  const baseDir = path.join(RAW_DIR, source, subType);
  const files = [];

  try {
    const dateDirs = await fs.readdir(baseDir);
    for (const dateDir of dateDirs) {
      if (dateFrom && dateDir < dateFrom) continue;
      if (dateTo && dateDir > dateTo) continue;

      const fullDir = path.join(baseDir, dateDir);
      const dayFiles = await fs.readdir(fullDir);
      files.push(...dayFiles.map((f) => path.join(fullDir, f)));
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  return files.sort();
}

/**
 * Cleanup old raw data beyond retention period
 */
export async function cleanupOldData(retentionDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  let removed = 0;

  const sources = await fs.readdir(RAW_DIR).catch(() => []);
  for (const source of sources) {
    const sourcePath = path.join(RAW_DIR, source);
    const stat = await fs.stat(sourcePath);
    if (!stat.isDirectory()) continue;

    const subTypes = await fs.readdir(sourcePath).catch(() => []);
    for (const subType of subTypes) {
      const subPath = path.join(sourcePath, subType);
      const dates = await fs.readdir(subPath).catch(() => []);
      for (const dateDir of dates) {
        if (dateDir < cutoffStr) {
          await fs.rm(path.join(subPath, dateDir), { recursive: true });
          removed++;
        }
      }
    }
  }

  log.info(`Cleanup complete: removed ${removed} date directories older than ${retentionDays} days`);
  return removed;
}

export default { saveRaw, readRaw, listRawFiles, cleanupOldData };
