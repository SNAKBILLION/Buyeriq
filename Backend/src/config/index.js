import dotenv from "dotenv";
dotenv.config();
const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT, 10) || 4000,
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  db: {
    url: process.env.DATABASE_URL,
    poolMin: parseInt(process.env.DB_POOL_MIN, 10) || 2,
    poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false, checkServerIdentity: () => undefined } : false,
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },
  apis: {
    frankfurter: process.env.FRANKFURTER_API || "https://api.frankfurter.app",
    comtrade: process.env.COMTRADE_API,
    importyetiKey: process.env.IMPORTYETI_API_KEY,
    wtoKey: process.env.WTO_API_KEY,
    newsApiKey: process.env.NEWS_API_KEY,
  },
  cors: {
    origin: process.env.CORS_ORIGIN === "*"
      ? "*"
      : (origin, callback) => {
          const allowed = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",");
          if (!origin || allowed.includes(origin)) {
            callback(null, true);
          } else if (
            process.env.NODE_ENV !== 'production' &&
            (
              origin.includes('.app.github.dev') ||
              origin === 'http://localhost:5173' ||
              origin === 'http://localhost:4000'
            )
          ) {
            callback(null, true);
          } else {
            callback(new Error('CORS blocked: ' + origin));
          }
        },
  },
  log: {
    level: process.env.LOG_LEVEL || "info",
    file: process.env.LOG_FILE || "logs/buyeriq.log",
  },
};
// ── Production Safety Guards ──
if (config.env === 'production') {
  if (config.jwt.secret === 'dev-secret-change-me') {
    throw new Error('FATAL: JWT_SECRET must be set in production. Do not use default.');
  }
  if (config.cors.origin === '*') {
    console.warn('WARNING: CORS_ORIGIN is set to wildcard (*) in production.');
  }
}
export default config;
