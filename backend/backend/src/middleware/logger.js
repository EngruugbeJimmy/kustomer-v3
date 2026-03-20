/**
 * Kustomer v5 — Structured logger using winston (free)
 *
 * Logs requests and errors WITHOUT logging sensitive data:
 * - Never logs passwords, tokens, card numbers
 * - Never logs full request bodies (could contain PII)
 * - Logs IP, method, path, status, response time only
 */

const winston = require("winston");
const path    = require("path");

// ── Winston logger setup ──────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console — always on
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const extras = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
          return `${timestamp} [${level}]: ${message}${extras}`;
        })
      )
    }),
  ],
  // Never crash app on logger error
  exceptionHandlers: [ new winston.transports.Console() ],
  rejectionHandlers: [ new winston.transports.Console() ],
});

// ── Sensitive fields to scrub from logs ──────────────────────
const SENSITIVE = ["password","token","authorization","secret","key","card","cvv","pin","otp"];

const scrub = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const clean = { ...obj };
  for (const key of Object.keys(clean)) {
    if (SENSITIVE.some(s => key.toLowerCase().includes(s))) {
      clean[key] = "[REDACTED]";
    }
  }
  return clean;
};

// ── Request logger middleware ─────────────────────────────────
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const log = {
      method:  req.method,
      path:    req.path,
      status:  res.statusCode,
      ms,
      ip:      req.ip?.replace("::ffff:","") || "unknown",
      ua:      req.headers["user-agent"]?.slice(0,80) || "",
    };

    // Log warnings for slow responses or errors
    if (res.statusCode >= 500) {
      logger.error("Server error", log);
    } else if (res.statusCode >= 400) {
      logger.warn("Client error", log);
    } else if (ms > 3000) {
      logger.warn("Slow response", log);
    } else {
      logger.info("Request", log);
    }
  });
  next();
};

// ── Error logger ──────────────────────────────────────────────
const errorLogger = (err, req, res, next) => {
  logger.error("Unhandled error", {
    message: err.message,
    path:    req.path,
    method:  req.method,
    ip:      req.ip?.replace("::ffff:","") || "unknown",
    // Never log err.stack in production (reveals file paths)
    stack:   process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });
  next(err);
};

module.exports = { logger, requestLogger, errorLogger, scrub };
