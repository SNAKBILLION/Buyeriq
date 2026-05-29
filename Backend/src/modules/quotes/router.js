import { Router } from "express";
import * as ctrl from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { createSchema, updateSchema, querySchema } from "./validation.js";
import { authenticate, authorize, authorizeQuotes } from "../../middleware/auth.js";

const router = Router();

// Bug fix: was optionalAuth → unauthenticated POSTs silently caused FK errors → "Failed to fetch"
// GET endpoints now require authentication as part of private API hardening
router.get("/",    authenticate, validate(querySchema, "query"), ctrl.getAll);
router.get("/:id", authenticate, ctrl.getOne);
// POST/PUT/DELETE require authentication
router.post("/",   authenticate, authorizeQuotes(), validate(createSchema), ctrl.create);
router.put("/:id",  authenticate, authorizeQuotes(), validate(updateSchema), ctrl.update);
router.delete("/:id", authenticate, authorize("admin"), ctrl.remove);

export default router;
