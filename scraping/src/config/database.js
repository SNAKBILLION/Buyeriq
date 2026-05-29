// ─────────────────────────────────────────────
// BuyerIQ — PostgreSQL Connection Pool
// ─────────────────────────────────────────────
import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

/**
 * Execute a query with automatic client management
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', {
      text: text.substring(0, 80),
      rows: result.rowCount,
      duration_ms: duration,
    });
    return result;
  } catch (err) {
    logger.error('Query failed', {
      text: text.substring(0, 80),
      error: err.message,
    });
    throw err;
  }
}

/**
 * Execute within a transaction
 */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Bulk upsert helper — generates ON CONFLICT DO UPDATE
 */
export function buildUpsert(table, rows, conflictCols, updateCols) {
  if (!rows.length) return { text: '', values: [] };

  const cols = Object.keys(rows[0]);
  const values = [];
  const valueRows = rows.map((row, ri) => {
    const placeholders = cols.map((col, ci) => {
      values.push(row[col]);
      return `$${ri * cols.length + ci + 1}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  const updates = updateCols
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(', ');

  const text = `
    INSERT INTO ${table} (${cols.join(', ')})
    VALUES ${valueRows.join(',\n')}
    ON CONFLICT (${conflictCols.join(', ')})
    DO UPDATE SET ${updates}, updated_at = NOW()
    RETURNING id
  `;

  return { text, values };
}

export async function healthCheck() {
  try {
    const res = await pool.query('SELECT NOW()');
    return { ok: true, time: res.rows[0].now };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export { pool };
export default { query, transaction, buildUpsert, pool, healthCheck };
