import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import winston from "winston";
import config from "./index.js";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
});

// Ensure log directory exists in production before creating File transport
const fileTransports = [];
if (config.env === "production" && config.log.file) {
  try {
    mkdirSync(dirname(config.log.file), { recursive: true });
    fileTransports.push(
      new winston.transports.File({ filename: config.log.file, maxsize: 5242880, maxFiles: 5 })
    );
  } catch (err) {
    console.warn(`Could not create log directory: ${err.message}. Logging to console only.`);
  }
}

export const logger = winston.createLogger({
  level: config.log.level || "info",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), errors({ stack: true }), logFormat),
  transports: [
    new winston.transports.Console({ format: combine(colorize(), logFormat) }),
    ...fileTransports,
  ],
});
