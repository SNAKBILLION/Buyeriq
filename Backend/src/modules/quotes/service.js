import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";
import { query } from "../../config/database.js";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class QuotesService extends BaseRepository {
  constructor() {
    super("quotes", ["buyer_id","product_id","status"]);
  }
  async create(data, userId = null) {
    const clean = { ...data };
    // Attach the creating user's ID for audit trail
    if (userId && !clean.created_by) {
      clean.created_by = userId;
    }
    // Frontend may send slug IDs ("tjx", "serving-tray") — resolve to UUID
    if (clean.buyer_id && !UUID_RE.test(clean.buyer_id)) {
      const r = await query(
        "SELECT id FROM buyers WHERE slug = $1 OR name ILIKE $2 LIMIT 1",
        [clean.buyer_id, `%${clean.buyer_id}%`]
      );
      if (!r.rows[0]) {
        throw ApiError.badRequest(`Buyer not found: "${clean.buyer_id}". Ensure buyers are seeded in the database.`);
      }
      clean.buyer_id = r.rows[0].id;
    }
    if (clean.product_id && !UUID_RE.test(clean.product_id)) {
      const r = await query(
        "SELECT id FROM products WHERE slug = $1 OR name ILIKE $2 LIMIT 1",
        [clean.product_id, `%${clean.product_id}%`]
      );
      if (!r.rows[0]) {
        throw ApiError.badRequest(`Product not found: "${clean.product_id}". Ensure products are seeded in the database.`);
      }
      clean.product_id = r.rows[0].id;
    }
    // Validate buyer_id FK exists if it's a UUID (prevents silent FK violation)
    if (clean.buyer_id && UUID_RE.test(clean.buyer_id)) {
      const r = await query("SELECT id FROM buyers WHERE id = $1 LIMIT 1", [clean.buyer_id]);
      if (!r.rows[0]) {
        throw ApiError.badRequest(`Buyer ID "${clean.buyer_id}" does not exist in the database. The buyer list may be using static demo data — seed the database first.`);
      }
    }
    if (clean.product_id && UUID_RE.test(clean.product_id)) {
      const r = await query("SELECT id FROM products WHERE id = $1 LIMIT 1", [clean.product_id]);
      if (!r.rows[0]) {
        throw ApiError.badRequest(`Product ID "${clean.product_id}" does not exist in the database. The product list may be using static demo data — seed the database first.`);
      }
    }
    // Remove null FK fields to avoid constraint errors
    if (!clean.buyer_id)   delete clean.buyer_id;
    if (!clean.product_id) delete clean.product_id;
    if (!clean.created_by) delete clean.created_by;
    return super.create(clean);
  }
  async findAll(filters = {}, pagination = {}) {
    // Resolve buyer_id slug to UUID — use local var, never mutate param
    let resolvedFilters = { ...filters };
    if (resolvedFilters.buyer_id && !UUID_RE.test(resolvedFilters.buyer_id)) {
      const r = await query(
        "SELECT id FROM buyers WHERE slug = $1 OR name ILIKE $2 LIMIT 1",
        [resolvedFilters.buyer_id, '%' + resolvedFilters.buyer_id + '%']
      );
      if (r.rows[0]) {
        resolvedFilters = { ...resolvedFilters, buyer_id: r.rows[0].id };
      } else {
        return { data: [], total: 0 };
      }
    }
    return super.findAll(resolvedFilters, pagination);
  }
  async getByIdentifier(identifier) {
    const record = await this.findById(identifier);
    if (!record) throw ApiError.notFound("Quote not found");
    return record;
  }
}
export default new QuotesService();
