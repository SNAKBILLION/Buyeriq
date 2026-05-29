import Joi from "joi";

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const inviteSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid("admin", "manager", "sales", "production", "viewer").default("viewer"),
});

export const updateRoleSchema = Joi.object({
  role: Joi.string().valid("admin", "manager", "sales", "production", "viewer").required(),
});
