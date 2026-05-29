import Joi from "joi";

export const createSchema = Joi.object({
  name: Joi.string().max(200),
  trade_value_usd: Joi.number(), market_share_pct: Joi.number(),
  notes: Joi.string().allow(""),
  confidence: Joi.string().valid("verified","industry_estimate","unverified"),
}).options({ allowUnknown: true });

export const updateSchema = createSchema.fork(
  Object.keys(createSchema.describe().keys),
  (field) => field.optional()
);

export const querySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(20000),
  sort_by: Joi.string(),
  sort_order: Joi.string().valid("asc","desc"),
  search: Joi.string().max(200),
  reporter_country: Joi.string(),
  partner_country: Joi.string(),
  hs_code: Joi.string(),
  year: Joi.string(),
  month: Joi.number().integer().min(1).max(12),
  data_source: Joi.string(),
  flow: Joi.string(),
}).options({ allowUnknown: true });
