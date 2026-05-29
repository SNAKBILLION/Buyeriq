import Joi from "joi";

export const createSchema = Joi.object({
  name: Joi.string().max(200),
  bol_number: Joi.string().max(50), weight_kg: Joi.number(),
  notes: Joi.string().allow(""),
  confidence: Joi.string().valid("verified","industry_estimate","unverified"),
}).options({ allowUnknown: true });

export const updateSchema = createSchema.fork(
  Object.keys(createSchema.describe().keys),
  (field) => field.optional()
);

export const querySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(1000),
  sort_by: Joi.string(),
  sort_order: Joi.string().valid("asc","desc"),
  search: Joi.string().max(200),
  buyer_id: Joi.string(),
  supplier_id: Joi.string(),
  hs_code: Joi.string(),
  origin_country: Joi.string(),
  dest_country: Joi.string(),
}).options({ allowUnknown: true });
