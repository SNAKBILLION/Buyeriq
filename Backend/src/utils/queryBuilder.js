// Dynamic SQL query builder for filters
// ALLOWED_SORT_COLUMNS prevents SQL injection via ORDER BY
const ALLOWED_SORT_COLUMNS = new Set([
  'created_at', 'updated_at', 'name', 'slug', 'tier', 'country_code',
  'region', 'fob_min', 'fob_max', 'score_payment', 'score_volume',
  'score_margin', 'score_growth', 'score_ease', 'price', 'rating',
  'review_count', 'best_seller_rank', 'ship_date', 'arrival_date',
  'weight_kg', 'trade_value_usd', 'year', 'quantity', 'urgency',
  'status', 'effective_date', 'email', 'role', 'code', 'category',
  'scraped_at', 'confidence', 'is_active', 'demand_score',
  'opportunity_score', 'buyer_score', 'relevance_score',
]);

const ALLOWED_DIRECTIONS = new Set(['ASC', 'DESC', 'asc', 'desc']);

function sanitizeOrderBy(orderBy) {
  if (!orderBy || typeof orderBy !== 'string') return 'created_at DESC';

  // Split "column direction" — e.g. "name ASC"
  const parts = orderBy.trim().split(/\s+/);
  const column = parts[0];
  const direction = parts[1] || 'DESC';

  if (!ALLOWED_SORT_COLUMNS.has(column)) return 'created_at DESC';
  if (!ALLOWED_DIRECTIONS.has(direction)) return `${column} DESC`;

  return `${column} ${direction.toUpperCase()}`;
}

export class QueryBuilder {
  constructor(baseQuery, countQuery) {
    this.baseQuery = baseQuery;
    this.countQuery = countQuery;
    this.conditions = [];
    this.params = [];
    this.paramIndex = 0;
  }

  where(field, value, operator = "=") {
    if (value === undefined || value === null || value === "") return this;
    this.paramIndex++;
    if (operator === "ILIKE") {
      this.conditions.push(`${field} ILIKE $${this.paramIndex}`);
      this.params.push(`%${value}%`);
    } else if (operator === "IN") {
      const vals = Array.isArray(value) ? value : [value];
      const placeholders = vals.map((_, i) => `$${this.paramIndex + i}`);
      this.conditions.push(`${field} IN (${placeholders.join(",")})`);
      this.params.push(...vals);
      this.paramIndex += vals.length - 1;
    } else if (operator === "ANY") {
      this.conditions.push(`$${this.paramIndex} = ANY(${field})`);
      this.params.push(value);
    } else {
      this.conditions.push(`${field} ${operator} $${this.paramIndex}`);
      this.params.push(value);
    }
    return this;
  }

  build(orderBy = "created_at DESC", limit = 25, offset = 0) {
    const safeOrder = sanitizeOrderBy(orderBy);
    const whereClause = this.conditions.length ? ` WHERE ${this.conditions.join(" AND ")}` : "";
    const limitIdx = ++this.paramIndex;
    const offsetIdx = ++this.paramIndex;
    return {
      query: `${this.baseQuery}${whereClause} ORDER BY ${safeOrder} LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      countQuery: `${this.countQuery}${whereClause}`,
      params: [...this.params, limit, offset],
      countParams: [...this.params],
    };
  }
}
