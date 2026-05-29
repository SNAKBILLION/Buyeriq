import pg from "pg";
import config from "./index.js";
import { logger } from "./logger.js";

const pool = new pg.Pool({
  connectionString: config.db.url,
  min: config.db.poolMin,
  max: config.db.poolMax,
  ssl: config.db.ssl,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("connect", () => logger.debug("DB pool: new connection"));
pool.on("error", (err) => logger.error("DB pool error:", err));

// Query helper with logging
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query executed in ${duration}ms — rows: ${result.rowCount}`);
    return result;
  } catch (err) {
    logger.error(`Query failed: ${err.message}`, { text: text.slice(0, 200) });
    throw err;
  }
}

// Transaction helper
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Health check
export async function healthCheck() {
  try {
    const res = await pool.query("SELECT NOW() as time, current_database() as db");
    return { ok: true, time: res.rows[0].time, database: res.rows[0].db, pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export default pool;
