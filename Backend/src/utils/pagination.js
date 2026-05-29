export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(20000, Math.max(1, parseInt(query.limit, 10) || 25));
  const offset = (page - 1) * limit;
  const sortBy = query.sort_by || "created_at";
  const sortOrder = query.sort_order === "asc" ? "ASC" : "DESC";
  return { page, limit, offset, sortBy, sortOrder };
}

export function paginatedResponse(data, total, { page, limit }) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}
