import Joi from "joi";

export const createSchema = Joi.object({
  name: Joi.string().max(200),
  fob_range_min: Joi.number().min(0), fob_range_max: Joi.number().min(0),
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
  hs_code: Joi.string(),
  category: Joi.string(),
}).options({ allowUnknown: true });
