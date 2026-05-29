import { query } from "../config/database.js";
import { QueryBuilder } from "./queryBuilder.js";

// FIX: Block dangerous fields that should never be set via API
const DANGEROUS_FIELDS = new Set([
  '__proto__', 'constructor', 'prototype',
  'id', 'created_at', 'updated_at',  // System fields — never allow override
]);

// FIX: Strip dangerous/system fields from user input before DB operations
function sanitizeData(data) {
  if (!data || typeof data !== 'object') return {};
  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    // Skip dangerous keys and prototype pollution attempts
    if (DANGEROUS_FIELDS.has(key)) continue;
    // Skip keys with special characters (SQL injection attempt)
    if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
    clean[key] = val;
  }
  return clean;
}

export class BaseRepository {
  constructor(tableName, fields = []) {
    this.table = tableName;
    this.fields = fields;
  }

  async findById(id) {
    const res = await query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
    return res.rows[0] || null;
  }

  async findBySlug(slug) {
    const res = await query(`SELECT * FROM ${this.table} WHERE slug = $1`, [slug]);
    return res.rows[0] || null;
  }

  async findAll(filters = {}, pagination = {}) {
    const { limit = 25, offset = 0, sortBy = "created_at", sortOrder = "DESC" } = pagination;
    // Sanitize sortBy — only allow alphanumeric + underscore column names
    const safeSortBy = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sortBy) ? sortBy : "created_at";
    const safeSortOrder = sortOrder?.toUpperCase() === "ASC" ? "ASC" : "DESC";
    const qb = new QueryBuilder(`SELECT * FROM ${this.table}`, `SELECT COUNT(*) FROM ${this.table}`);
    
    for (const [key, val] of Object.entries(filters)) {
      if (val === undefined || val === null || val === "") continue;
      if (key === "search") qb.where("name", val, "ILIKE");
      else if (key === "country_code") qb.where("country_code", val);
      else if (key === "tier") qb.where("tier", val);
      else if (key === "is_active") qb.where("is_active", val);
      else if (this.fields.includes(key)) qb.where(key, val);
    }

    const built = qb.build(`${safeSortBy} ${safeSortOrder}`, limit, offset);
    const [dataRes, countRes] = await Promise.all([
      query(built.query, built.params),
      query(built.countQuery, built.countParams),
    ]);
    return { data: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) };
  }

  async create(data) {
    // FIX: Strip dangerous/system fields before insert
    const safeData = sanitizeData(data);
    const keys = Object.keys(safeData);
    const values = Object.values(safeData);
    if (keys.length === 0) throw new Error('No valid fields to insert');
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const res = await query(
      `INSERT INTO ${this.table} (${keys.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
      values
    );
    const record = res.rows[0];
    if (record?.id) this._audit('INSERT', record.id, null, record).catch(() => {});
    return record;
  }

  async update(id, data) {
    const old = await this.findById(id);
    // FIX: Strip dangerous/system fields before update
    const safeData = sanitizeData(data);
    const keys = Object.keys(safeData);
    const values = Object.values(safeData);
    if (keys.length === 0) throw new Error('No valid fields to update');
    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    values.push(id);
    const res = await query(
      `UPDATE ${this.table} SET ${sets.join(",")}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    const record = res.rows[0] || null;
    if (record?.id) this._audit('UPDATE', id, old, record, Object.keys(safeData)).catch(() => {});
    return record;
  }

  async delete(id) {
    const old = await this.findById(id);
    const res = await query(`DELETE FROM ${this.table} WHERE id = $1 RETURNING id`, [id]);
    if (res.rowCount > 0) this._audit('DELETE', id, old, null).catch(() => {});
    return res.rowCount > 0;
  }

  async _audit(action, recordId, oldValues, newValues, changedFields = null) {
    try {
      await query(
        `INSERT INTO data_audit_log (table_name, record_id, action, changed_fields, old_values, new_values, data_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          this.table,
          recordId,
          action,
          changedFields ? JSON.stringify(changedFields) : null,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          'backend_api',
        ]
      );
    } catch { /* audit failure should not block operations */ }
  }

  async count(filters = {}) {
    const qb = new QueryBuilder("", `SELECT COUNT(*) FROM ${this.table}`);
    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null) qb.where(key, val);
    }
    const built = qb.build();
    const res = await query(built.countQuery, built.countParams);
    return parseInt(res.rows[0].count, 10);
  }
}
