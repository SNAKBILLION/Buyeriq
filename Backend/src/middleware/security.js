// ─────────────────────────────────────────────
// BuyerIQ — Security Middleware
// ─────────────────────────────────────────────
// - Input sanitization (anti-XSS)
// - HTTP Parameter Pollution protection
// - Request ID tracking
// - Content-Type enforcement
// ─────────────────────────────────────────────
import crypto from "crypto";

// ═══ 1. INPUT SANITIZER (Anti-XSS) ═══
function sanitizeValue(val) {
  if (typeof val !== "string") return val;
  return val
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/data:\s*text\/html/gi, "")
    .replace(/&#x?[0-9a-f]+;/gi, "")        // Strip HTML entities
    .replace(/\\u[0-9a-f]{4}/gi, "")         // Strip unicode escapes
    .replace(/["']/g, (m) => m === '"' ? '&quot;' : '&#x27;') // Encode quotes
    .trim();
}

function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeValue(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === "object") {
    const clean = {};
    for (const [key, val] of Object.entries(obj)) {
      const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, "");
      if (safeKey === "__proto__" || safeKey === "constructor" || safeKey === "prototype") continue;
      clean[safeKey] = sanitizeObject(val);
    }
    return clean;
  }
  return obj;
}

export function inputSanitizer(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(req.params);
  }
  next();
}

// ═══ 2. HTTP PARAMETER POLLUTION (HPP) PROTECTION ═══
const HPP_WHITELIST = new Set(["ids", "tags", "hs_codes", "countries"]);

export function hppProtection(req, res, next) {
  if (req.query) {
    for (const [key, val] of Object.entries(req.query)) {
      if (Array.isArray(val) && !HPP_WHITELIST.has(key)) {
        req.query[key] = val[val.length - 1];
      }
    }
  }
  next();
}

// ═══ 3. REQUEST ID TRACKING ═══
// Always generate server-side — never trust client header
export function requestId(req, res, next) {
  const id = crypto.randomUUID();  // Always server-generated
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}

// ═══ 4. CONTENT-TYPE ENFORCEMENT ═══
export function enforceContentType(req, res, next) {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const ct = req.headers["content-type"] || "";
    if (!ct.includes("application/json") && !ct.includes("multipart/form-data")) {
      return res.status(415).json({
        success: false,
        error: { message: "Content-Type must be application/json" },
      });
    }
  }
  next();
}

// ═══ 5. SECURITY HEADERS (additional to Helmet) ═══
export function additionalSecurityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.path.includes("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
  }
  next();
}
