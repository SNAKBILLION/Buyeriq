import supabase from "../config/supabase.js";
import { query } from "../config/database.js";
import { ApiError } from "../utils/ApiError.js";

async function findAppUserByEmail(email) {
  if (!email) return null;
  const res = await query(
    "SELECT id, name, email, role, is_active FROM users WHERE email = $1 LIMIT 1",
    [email]
  );
  return res.rows[0] || null;
}

async function decodeAuthToken(token) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw ApiError.unauthorized("Invalid or expired token");
  }
  const appUser = await findAppUserByEmail(data.user.email);
  return {
    id: appUser?.id || data.user.id,
    email: data.user.email,
    name: appUser?.name || data.user.user_metadata?.name || null,
    role: appUser?.role || data.user.user_metadata?.role || "viewer",
    is_active: appUser?.is_active ?? true,
    provider: "supabase",
  };
}

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return next(ApiError.unauthorized("No token provided"));
    }
    const token = header.split(" ")[1];
    req.user = await decodeAuthToken(token);
    if (req.user.is_active === false) {
      return next(ApiError.forbidden("User is inactive"));
    }
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(ApiError.unauthorized("Invalid or expired token"));
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (roles.length && !roles.includes(req.user.role)) return next(ApiError.forbidden("Insufficient permissions"));
    next();
  };
}

// Convenience: authorize for write operations (admin + manager)
export function authorizeWrite() { return authorize("admin", "manager"); }

// Convenience: authorize for quote creation (admin + manager + sales)
export function authorizeQuotes() { return authorize("admin", "manager", "sales"); }

export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = await decodeAuthToken(header.split(" ")[1]);
    } catch {
      // ignore invalid tokens
    }
  }
  next();
}
