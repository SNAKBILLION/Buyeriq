import { Router } from "express";
import * as ctrl from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { registerSchema, loginSchema, inviteSchema, updateRoleSchema } from "./validation.js";
import { authenticate, authorize, optionalAuth } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimiter.js";

const router = Router();

// Public (rate-limited)
router.post("/register", authLimiter, validate(registerSchema), ctrl.register);  // Disabled — returns 403
router.post("/login",    authLimiter, validate(loginSchema), ctrl.login);

// Authenticated — profile requires valid token
router.get("/me", authenticate, ctrl.getProfile);

// Admin only — User Management (MUST be authenticate, not optionalAuth)
// Bug fix: was optionalAuth → unauthenticated requests could list all users
router.get("/",           authenticate, authorize("admin", "manager"), ctrl.getAll);
router.post("/invite",    authenticate, authorize("admin"), validate(inviteSchema), ctrl.invite);
router.patch("/:id/role", authenticate, authorize("admin"), validate(updateRoleSchema), ctrl.updateRole);
router.patch("/:id/toggle", authenticate, authorize("admin"), ctrl.toggleActive);
router.delete("/:id",     authenticate, authorize("admin"), ctrl.remove);

export default router;
