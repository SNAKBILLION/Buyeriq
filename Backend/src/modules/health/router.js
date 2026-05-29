import { Router } from "express";
import { healthCheck } from "../../config/database.js";

const router = Router();

router.get("/", async (req, res) => {
  const db = await healthCheck();
  const status = db.ok ? 200 : 503;
  res.status(status).json({
    status: db.ok ? "healthy" : "unhealthy",
    version: "1.0.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: db,
  });
});

export default router;
