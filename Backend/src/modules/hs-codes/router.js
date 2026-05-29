import { Router } from "express";
import * as ctrl from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { createSchema, updateSchema, querySchema } from "./validation.js";
import { authenticate, authorize, authorizeWrite } from "../../middleware/auth.js";

const router = Router();

router.get("/",    authenticate, validate(querySchema, "query"), ctrl.getAll);
router.get("/:code", authenticate, ctrl.getOne);
router.post("/",   authenticate, authorizeWrite(), validate(createSchema), ctrl.create);
router.put("/:code",  authenticate, authorizeWrite(), validate(updateSchema), ctrl.update);
router.delete("/:code", authenticate, authorize("admin"), ctrl.remove);

export default router;
