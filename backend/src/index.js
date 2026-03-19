require("dotenv").config();
const express   = require("express");
const mongoose  = require("mongoose");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "10kb" }));
app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use("/api", rateLimit({ windowMs: 15*60*1000, max: 200 }));

app.use("/api/auth",      require("./routes/auth"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/products",  require("./routes/products"));
app.use("/api/messages",  require("./routes/messages"));
app.use("/api/catalog",   require("./routes/catalog"));
app.use("/api/billing",   require("./routes/billing"));
app.use("/api/reseller",  require("./routes/reseller"));

app.get("/api/health", (_, res) => res.json({ status: "ok", version: "3.0" }));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log("🚀 Kustomer v3 API on port", PORT));
  })
  .catch(err => { console.error("❌", err.message); process.exit(1); });
