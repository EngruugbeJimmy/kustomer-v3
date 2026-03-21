require("dotenv").config();
const express   = require("express");
const mongoose  = require("mongoose");
const cors      = require("cors");
const path      = require("path");
const fs        = require("fs");

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

// ── 2. Security headers ───────────────────────────────────────
app.use(helmetConfig);
app.use(securityHeaders);

// ── 3. CORS ───────────────────────────────────────────────────
const normOrigin = (o) => (o || "").replace(/\/$/, "").toLowerCase();

const allowedOrigins = [
  normOrigin(process.env.FRONTEND_URL || ""),
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // No origin = mobile, Postman, server-to-server — allow
    if (!origin) return cb(null, true);
    const incoming = normOrigin(origin);
    // Exact match
    if (allowedOrigins.includes(incoming)) return cb(null, true);
    // Any Vercel deployment for this project
    if (incoming.includes("vercel.app")) return cb(null, true);
    // Render internal
    if (incoming.includes("onrender.com")) return cb(null, true);
    cb(new Error("CORS blocked: " + origin));
  },
  credentials: true,
  methods: ["GET","POST","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  optionsSuccessStatus: 200,
};

// Handle OPTIONS preflight BEFORE all other middleware
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

// ── 4. Body parsing ───────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ── 5. NoSQL injection sanitisation ──────────────────────────
app.use(mongoSanitizeConfig);

// ── 6. HTTP parameter pollution protection ────────────────────
app.use(hppConfig);

// ── 7. Suspicious pattern detection ──────────────────────────
app.use(suspiciousPatternDetector);

// ── 8. Request logging ────────────────────────────────────────
app.use(requestLogger);

// ── 9. Static video files ─────────────────────────────────────
const videoDir = path.join(__dirname, "../temp/videos");
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
app.use("/videos", express.static(videoDir));

// ── 10. Routes with tiered rate limiting ──────────────────────
app.use("/api/auth",      authLimiter,    require("./routes/auth"));
app.use("/api/catalog",   catalogLimiter, require("./routes/catalog"));
app.use("/api/billing",   paymentLimiter, require("./routes/billing"));
app.post("/api/billing/webhook", require("./routes/billing"));
app.use("/api/ai-seo",    aiLimiter,      require("./routes/aiseo"));
app.use("/api/marketing", aiLimiter, accountGuard, require("./routes/marketing"));
app.use("/api/youtube",   aiLimiter, accountGuard, require("./routes/youtube"));
app.use("/api",           apiLimiter);
app.use("/api/customers", accountGuard, require("./routes/customers"));
app.use("/api/products",  accountGuard, require("./routes/products"));
app.use("/api/reseller",  require("./routes/reseller"));
app.use("/api/domains",   require("./routes/domains"));
app.use("/api/discover",  require("./routes/discover"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/agents",    accountGuard, require("./routes/agents"));
app.use("/api/agent",     accountGuard, require("./routes/agent"));
app.use("/api/social",    accountGuard, require("./routes/social"));
app.use("/api/verify",    require("./routes/verify"));

// ── 11. Health check ──────────────────────────────────────────
app.get("/api/health", (_, res) => res.json({ status:"ok", version:"5.0" }));

// ── 12. 404 ───────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error:"Route not found" }));

// ── 13. Global error handler ──────────────────────────────────
app.use(errorLogger);
app.use((err, req, res, next) => {
  if (err.message?.includes("CORS blocked")) {
    return res.status(403).json({ error:"Access not allowed" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error:"Request too large" });
  }
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error:"Invalid token" });
  }
  const message = process.env.NODE_ENV === "production"
    ? "Something went wrong"
    : err.message || "Server error";
  res.status(err.status || 500).json({ error: message });
});

// ── 14. MongoDB ───────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI, {
  sanitizeFilter: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log("✅ MongoDB connected");
    // Start AI Agent Scheduler
    try {
      const { startScheduler } = require("./services/agentScheduler");
      startScheduler();
    } catch (e) { console.warn("Scheduler not started:", e.message); }
    app.listen(process.env.PORT || 5000, () => {
      console.log("🚀 Kustomer v5 running");
    });
  })
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ── 15. Graceful shutdown ─────────────────────────────────────
process.on("SIGTERM", () => {
  mongoose.connection.close(() => process.exit(0));
});
