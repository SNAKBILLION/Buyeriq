import express from "express";
import { generateEmail } from "./controller.js";
import { authenticate } from "../../middleware/auth.js";
import { strictLimiter } from "../../middleware/rateLimiter.js";

const router = express.Router();
router.post("/email", authenticate, strictLimiter, generateEmail);
export default router;
