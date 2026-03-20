require("dotenv").config();
const express   = require("express");
const mongoose  = require("mongoose");
const cors      = require("cors");
const path      = require("path");
const fs        = require("fs");

// ── Security middleware (all zero-cost) ───────────────────────
const {
  helmetConfig, mongoSanitizeConfig, hppConfig,
  authLimiter, apiLimiter, paymentLimiter, aiLimiter,
  catalogLimiter, securityHeaders, suspiciousPatternDetector,
} = require("./middleware/security");
const { requestLogger, errorLogger } = require("./middleware/logger");
const accountGuard = require("./middleware/accountGuard");

const app = express();

// ── 1. Trust proxy (needed for accurate IP on Render) ─────────
app.set("trust proxy", 1);

// ── 2. Security headers — applied to every response ───────────
app.use(helmetConfig);
app.use(securityHeaders);

// ── 3. CORS — only allow your frontend ───────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("CORS: origin not allowed — " + origin));
  },
  credentials: true,
  methods: ["GET","POST","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));

// ── 4. Body parsing with strict size limit ────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ── 5. NoSQL injection sanitisation ──────────────────────────
app.use(mongoSanitizeConfig);

// ── 6. HTTP parameter pollution protection ────────────────────
app.use(hppConfig);

// ── 7. Suspicious pattern detection ──────────────────────────
app.use(suspiciousPatternDetector);

// ── 8. Request logging (no sensitive data logged) ─────────────
app.use(requestLogger);

// ── 9. Static files for videos ────────────────────────────────
const videoDir = path.join(__dirname, "../temp/videos");
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
app.use("/videos", express.static(videoDir));

// ── 10. Routes with tiered rate limiting ──────────────────────

// Auth: strict limit — 10 failed attempts per 15 min per IP
app.use("/api/auth",      authLimiter,    require("./routes/auth"));

// Catalog: generous — customers browsing
app.use("/api/catalog",   catalogLimiter, require("./routes/catalog"));

// Payments: strict — 20 attempts per hour
app.use("/api/billing",   paymentLimiter, require("./routes/billing"));

// AI generation: strict — costs money per call
app.use("/api/ai-seo",    aiLimiter,      require("./routes/aiseo"));
app.use("/api/marketing", aiLimiter, accountGuard, require("./routes/marketing"));
app.use("/api/youtube",   aiLimiter, accountGuard, require("./routes/youtube"));

// Everything else: standard limit
app.use("/api",           apiLimiter);
app.use("/api/customers", accountGuard, require("./routes/customers"));
app.use("/api/products",  accountGuard, require("./routes/products"));
app.use("/api/reseller",  require("./routes/reseller"));
app.use("/api/domains",   require("./routes/domains"));
app.use("/api/discover",  require("./routes/discover"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/agents",    accountGuard, require("./routes/agents"));
app.use("/api/verify",    require("./routes/verify"));

// ── 11. Health check (no sensitive info exposed) ──────────────
app.get("/api/health", (_, res) => res.json({
  status: "ok",
  version: "5.0",
  // Never expose: database URL, env vars, internal paths
}));

// ── 12. 404 handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── 13. Global error handler — never leaks stack traces ───────
app.use(errorLogger);
app.use((err, req, res, next) => {
  // CORS errors
  if (err.message?.includes("CORS")) {
    return res.status(403).json({ error: "Access not allowed" });
  }
  // Payload too large
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request too large" });
  }
  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "Invalid token" });
  }
  // Never send stack trace to client in production
  const message = process.env.NODE_ENV === "production"
    ? "Something went wrong"
    : err.message || "Server error";
  res.status(err.status || 500).json({ error: message });
});

// ── 14. Connect to MongoDB with security options ───────────────
mongoose.connect(process.env.MONGODB_URI, {
  // Automatically sanitise queries (belt and suspenders with mongoSanitize)
  sanitizeFilter: true,
  // Limit query execution time — prevents slow query attacks
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(process.env.PORT || 5000, () => {
      console.log("🚀 Kustomer v5 running — security hardened");
    });
  })
  .catch(err => {
    // Never log the full URI — it contains credentials
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ── 15. Graceful shutdown ─────────────────────────────────────
process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  mongoose.connection.close(() => process.exit(0));
});
