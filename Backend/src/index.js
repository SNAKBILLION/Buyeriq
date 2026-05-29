import app from "./app.js";
import config from "./config/index.js";
import { logger } from "./config/logger.js";
import { healthCheck } from "./config/database.js";

async function start() {
  // Test DB connection
  const db = await healthCheck();
  if (db.ok) {
    logger.info(`Database connected: ${db.database}`);
  } else {
    logger.error(`Database connection failed: ${db.error}`);
    logger.warn("Starting without database — some features will be unavailable");
  }

  // Initialize background jobs (optional — requires Redis)
  try {
    const { initializeJobs } = await import("./jobs/index.js");
    initializeJobs();
  } catch (err) {
    logger.warn(`Background jobs disabled: ${err.message}`);
  }

  // Start server
  app.listen(config.port, () => {
    logger.info(`BuyerIQ API running on port ${config.port} [${config.env}]`);
    logger.info(`Endpoints: http://localhost:${config.port}${config.apiPrefix}`);
  });
}

start().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  process.exit(1);
});
