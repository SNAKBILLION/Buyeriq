import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import config from "./config/index.js";
import { apiLimiter, writeLimiter, strictLimiter } from "./middleware/rateLimiter.js";
import { inputSanitizer, hppProtection, requestId, enforceContentType, additionalSecurityHeaders } from "./middleware/security.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// Module routers
import healthRouter from "./modules/health/router.js";
import buyersRouter from "./modules/buyers/router.js";
import suppliersRouter from "./modules/suppliers/router.js";
import productsRouter from "./modules/products/router.js";
import hsCodesRouter from "./modules/hs-codes/router.js";
import shipmentsRouter from "./modules/shipments/router.js";
import tradeStatsRouter from "./modules/trade-stats/router.js";
import pricesRouter from "./modules/prices/router.js";
import retailRouter from "./modules/retail/router.js";
import complianceRouter from "./modules/compliance/router.js";
import contactsRouter from "./modules/contacts/router.js";
import alertsRouter from "./modules/alerts/router.js";
import quotesRouter from "./modules/quotes/router.js";
import usersRouter from "./modules/users/router.js";
import tariffsRouter from "./modules/tariffs/router.js";
import aiRouter from "./modules/ai/router.js";
import ratesRouter from "./modules/rates/router.js";

const app = express();
app.set("trust proxy", 1);

// ── Global Middleware (Security Stack) ──
app.use(requestId);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(additionalSecurityHeaders);
app.use(cors({ 
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(inputSanitizer);
app.use(hppProtection);
app.use(enforceContentType);
app.use(morgan(":method :url :status :res[content-length] - :response-time ms [:req[x-request-id]]"));
app.use(apiLimiter);
app.use(writeLimiter);

// ── Routes ──
const api = config.apiPrefix;

app.use(`${api}/health`,      healthRouter);
app.use(`${api}/buyers`,      buyersRouter);
app.use(`${api}/suppliers`,   suppliersRouter);
app.use(`${api}/products`,    productsRouter);
app.use(`${api}/hs-codes`,    hsCodesRouter);
app.use(`${api}/shipments`,   shipmentsRouter);
app.use(`${api}/trade-stats`, tradeStatsRouter);
app.use(`${api}/prices`,      pricesRouter);
app.use(`${api}/retail`,      retailRouter);
app.use(`${api}/compliance`,  complianceRouter);
app.use(`${api}/contacts`,    contactsRouter);
app.use(`${api}/tariffs`,    tariffsRouter);
app.use(`${api}/ai`,          aiRouter);
app.use(`${api}/alerts`,      alertsRouter);
app.use(`${api}/quotes`,      quotesRouter);
app.use(`${api}/users`,       usersRouter);
app.use(`${api}/rates`,       ratesRouter);

// Root
app.get("/", (req, res) => {
  res.json({
    name: "BuyerIQ API",
    version: "1.0.0",
    company: "Senses Lifestyle",
    docs: "/api/docs",
    endpoints: {
      buyers: `${api}/buyers`,
      suppliers: `${api}/suppliers`,
      products: `${api}/products`,
      "trade-stats": `${api}/trade-stats`,
      compliance: `${api}/compliance`,
      quotes: `${api}/quotes`,
      notifications: `${api}/notifications/status`,
      erp: `${api}/erp/status`,
    },
  });
});

// ── Notification Routes (with validation + strict rate limit) ──
import { sendEmail, sendWhatsApp, sendAlertNotification, getNotificationStatus } from "./services/notifications.js";
import { authenticate, authorize } from "./middleware/auth.js";
import Joi from "joi";

const notifSendSchema = Joi.object({
  channel: Joi.string().valid("email", "whatsapp").required(),
  to: Joi.string().max(200).required(),
  subject: Joi.string().max(500).allow(""),
  body: Joi.string().max(5000).allow(""),
  html: Joi.string().max(10000).allow(""),
}).options({ stripUnknown: true });

const erpPushQuoteSchema = Joi.object({
  id: Joi.string().uuid(),
  product_name: Joi.string().max(200).required(),
  wood_type: Joi.string().max(50),
  quantity: Joi.number().integer().min(1).required(),
  unit: Joi.string().max(20),
  fob_per_unit: Joi.number().positive().required(),
  fob_currency: Joi.string().max(3),
  total_usd: Joi.number(),
  exchange_rate: Joi.number(),
  total_inr: Joi.number(),
  incoterm: Joi.string().max(10),
  origin_port: Joi.string().max(100),
  buyer_name: Joi.string().max(200),
  notes: Joi.string().max(1000).allow(""),
}).options({ stripUnknown: true });

app.get(`${api}/notifications/status`, authenticate, authorize("admin"), (req, res) => {
  res.json({ success: true, data: getNotificationStatus() });
});

app.post(`${api}/notifications/send`, authenticate, authorize("admin"), strictLimiter, async (req, res) => {
  const { error, value } = notifSendSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, error: { message: "Validation failed", details: error.details.map(d => d.message) } });

  let result;
  if (value.channel === "email") {
    result = await sendEmail({ to: value.to, subject: value.subject, body: value.body, html: value.html });
  } else {
    result = await sendWhatsApp({ to: value.to, body: value.body });
  }
  res.json({ success: result.success, data: result });
});

app.post(`${api}/notifications/test`, authenticate, authorize("admin"), strictLimiter, async (req, res) => {
  const result = await sendAlertNotification({
    type: "test", urgency: "medium",
    title: "BuyerIQ Test Notification",
    message: "This is a test notification from BuyerIQ. If you received this, notifications are working correctly.",
  });
  res.json({ success: true, data: result });
});

// ── ERP Integration Routes (with validation + strict rate limit) ──
import { pushQuoteToERP, pullProductCatalog, pullBuyerMaster, getOrderStatus, getRecentInvoices, runFullSync, getERPStatus } from "./services/erp.js";

app.get(`${api}/erp/status`, authenticate, (req, res) => {
  res.json({ success: true, data: getERPStatus() });
});

app.post(`${api}/erp/sync`, authenticate, authorize("admin"), strictLimiter, async (req, res) => {
  const result = await runFullSync();
  res.json({ success: true, data: result });
});

app.post(`${api}/erp/push-quote`, authenticate, authorize("admin", "manager", "sales"), async (req, res) => {
  const { error, value } = erpPushQuoteSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, error: { message: "Validation failed", details: error.details.map(d => d.message) } });
  const result = await pushQuoteToERP(value);
  res.json({ success: result.success, data: result });
});

app.get(`${api}/erp/products`, authenticate, async (req, res) => {
  const result = await pullProductCatalog();
  res.json({ success: result.success, data: result });
});

app.get(`${api}/erp/buyers`, authenticate, async (req, res) => {
  const result = await pullBuyerMaster();
  res.json({ success: result.success, data: result });
});

app.get(`${api}/erp/invoices`, authenticate, async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const result = await getRecentInvoices(limit);
  res.json({ success: result.success, data: result });
});

app.get(`${api}/erp/orders/:id/status`, authenticate, async (req, res) => {
  if (!req.params.id?.match(/^[a-zA-Z0-9-]+$/)) {
    return res.status(400).json({ success: false, error: { message: "Invalid order ID format" } });
  }
  const result = await getOrderStatus(req.params.id);
  res.json({ success: result.success, data: result });
});

// ── API Documentation ──
import { serveAPIDocs } from "./config/swagger.js";
serveAPIDocs(app);

// ── Error Handling ──
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
