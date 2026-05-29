import { logger } from "../config/logger.js";

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : "Internal server error";

  logger.error(`${statusCode} ${req.method} ${req.originalUrl}: ${err.message}`, {
    stack: err.stack,
    errors: err.errors,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(err.errors?.length && { details: err.errors }),
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: { message: `Route ${req.method} ${req.originalUrl} not found` } });
}
