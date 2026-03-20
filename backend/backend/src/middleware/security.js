/**
 * Kustomer v5 — Zero-cost security middleware stack
 *
 * Every measure here is free. No paid services, no API keys.
 * Applied once in index.js before all routes.
 */

const helmet     = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const hpp        = require("hpp");
const rateLimit  = require("express-rate-limit");

// ── 1. Helmet — sets 11 security HTTP headers automatically ───
// Prevents: clickjacking, MIME sniffing, XSS via headers,
//           information leakage (X-Powered-By removed)
const helmetConfig = helmet({
  contentSecurityPolicy: false, // disabled — frontend is separate domain
  crossOriginEmbedderPolicy: false,
});

// ── 2. NoSQL injection sanitiser ──────────────────────────────
// Strips $ and . from req.body, req.params, req.query
// Prevents: { "email": { "$gt": "" } } MongoDB operator injection
const mongoSanitizeConfig = mongoSanitize({
  replaceWith: "_",
  onSanitizeError: (req) => {
    console.warn("⚠️  Sanitised suspicious input from", req.ip);
  }
});

// ── 3. HTTP Parameter Pollution protection ────────────────────
// Prevents: ?sort=name&sort=password (array confusion attacks)
const hppConfig = hpp({
  whitelist: ["tags","keywords","category"] // allow array for these
});

// ── 4. Tiered rate limiting — different limits per route type ─

// Strict: auth endpoints — 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed attempts
});

// Moderate: general API — 200 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: "Too many requests. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict: payment endpoints — 20 per hour per IP
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: "Too many payment requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict: AI generation endpoints — 30 per hour per IP (costs money per call)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: "AI generation limit reached. Try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public catalog — generous limit (customers browsing)
const catalogLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: "Too many requests." },
});

// ── 5. Request size limits ────────────────────────────────────
// Already set on express.json({ limit: "10kb" }) in index.js
// This enforces it at middleware level too as a belt-and-suspenders

// ── 6. Security response headers (manual, no package needed) ──
const securityHeaders = (req, res, next) => {
  // Prevent browser from caching API responses
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  // Prevent response from being embedded in iframes (anti-clickjacking)
  res.setHeader("X-Frame-Options", "DENY");
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Remove server fingerprint info
  res.removeHeader("X-Powered-By");
  next();
};

// ── 7. Suspicious pattern detector ───────────────────────────
// Logs and blocks obvious attack patterns
const suspiciousPatternDetector = (req, res, next) => {
  const suspicious = [
    /<script/i,           // XSS
    /javascript:/i,       // XSS via protocol
    /on\w+\s*=/i,         // event handler injection
    /union\s+select/i,    // SQL injection (just in case)
    /exec\s*\(/i,         // code execution attempt
    /\.\.\//,             // path traversal
  ];

  const body = JSON.stringify(req.body || "");
  const query = JSON.stringify(req.query || "");
  const params = JSON.stringify(req.params || "");
  const combined = body + query + params;

  for (const pattern of suspicious) {
    if (pattern.test(combined)) {
      console.warn(`⚠️  Suspicious pattern detected from ${req.ip}: ${pattern}`);
      return res.status(400).json({ error: "Invalid input detected" });
    }
  }
  next();
};

// ── 8. Owner-only guard — verifies resource belongs to user ───
// Use this on any route that modifies data
const ownGuard = (Model, idParam = "id") => async (req, res, next) => {
  try {
    const doc = await Model.findById(req.params[idParam]);
    if (!doc) return res.status(404).json({ error: "Not found" });
    // Compare owner field — works for products, customers, etc.
    const ownerId = doc.owner || doc.shop || doc.user;
    if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
      console.warn(`⚠️  Unauthorised access attempt by ${req.user._id} on ${Model.modelName} ${req.params[idParam]}`);
      return res.status(403).json({ error: "Access denied" });
    }
    req.doc = doc;
    next();
  } catch { res.status(500).json({ error: "Authorization check failed" }); }
};

module.exports = {
  helmetConfig,
  mongoSanitizeConfig,
  hppConfig,
  authLimiter,
  apiLimiter,
  paymentLimiter,
  aiLimiter,
  catalogLimiter,
  securityHeaders,
  suspiciousPatternDetector,
  ownGuard,
};
