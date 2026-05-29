import Joi from "joi";

export const createSchema = Joi.object({
  company_id: Joi.string().uuid(),
  buyer_id: Joi.string().uuid(),
  supplier_id: Joi.string().uuid(),
  full_name: Joi.string().max(200).required(),
  job_title: Joi.string().max(200),
  department: Joi.string().max(100),
  email: Joi.string().email().allow("", null),
  phone: Joi.string().max(50),
  linkedin_url: Joi.string().uri().allow("", null),
  discovery_source: Joi.string().max(50),
  discovery_date: Joi.date(),
  confidence: Joi.string().valid("verified", "industry_estimate", "unverified"),
  is_verified: Joi.boolean(),
  notes: Joi.string().allow(""),
}).options({ allowUnknown: false });

export const updateSchema = Joi.object({
  full_name: Joi.string().max(200),
  job_title: Joi.string().max(200),
  department: Joi.string().max(100),
  email: Joi.string().email().allow("", null),
  phone: Joi.string().max(50),
  linkedin_url: Joi.string().uri().allow("", null),
  confidence: Joi.string().valid("verified", "industry_estimate", "unverified"),
  is_verified: Joi.boolean(),
  notes: Joi.string().allow(""),
}).options({ allowUnknown: false });

export const querySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(1000),
  sort_by: Joi.string(),
  sort_order: Joi.string().valid("asc", "desc"),
  search: Joi.string().max(200),
  company_id: Joi.string(),
  buyer_id: Joi.string(),
  supplier_id: Joi.string(),
  department: Joi.string(),
}).options({ allowUnknown: true });
