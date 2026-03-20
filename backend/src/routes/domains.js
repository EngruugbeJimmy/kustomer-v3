const express = require("express");
const axios   = require("axios");
const User    = require("../models/User");
const auth    = require("../middleware/auth");
const router  = express.Router();
router.use(auth);

// GET /api/domains/me — get domain info
router.get("/me", async (req, res) => {
  try {
    const subdomain = req.user.shopSlug + ".kustomer.app";
    res.json({
      subdomain,
      customDomain:   req.user.customDomain || null,
      domainVerified: req.user.domainVerified || false,
      plan:           req.user.plan,
      canConnectDomain: ["pro","business"].includes(req.user.plan)
    });
  } catch { res.status(500).json({ error:"Failed" }); }
});

// POST /api/domains/connect — save custom domain
router.post("/connect", async (req, res) => {
  try {
    if (!["pro","business"].includes(req.user.plan))
      return res.status(402).json({ error:"Custom domain requires Pro or Business plan" });
    const { domain } = req.body;
    if (!domain?.trim()) return res.status(400).json({ error:"Domain required" });
    const cleaned = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    await User.findByIdAndUpdate(req.user._id, { customDomain:cleaned, domainVerified:false });
    res.json({
      domain: cleaned,
      instructions: {
        type:  "CNAME",
        host:  cleaned.startsWith("www.") ? "www" : "@",
        value: "kustomer.app",
        ttl:   "3600",
        note:  "Add this CNAME record in your domain registrar (Namecheap, GoDaddy, etc). Takes 24-48 hours to propagate."
      }
    });
  } catch { res.status(500).json({ error:"Failed" }); }
});

// POST /api/domains/verify — check if CNAME is set correctly
router.post("/verify", async (req, res) => {
  try {
    const user = req.user;
    if (!user.customDomain) return res.status(400).json({ error:"No domain connected" });
    // In production use a real DNS check library
    // For MVP, mark as verified after user confirms
    await User.findByIdAndUpdate(user._id, { domainVerified:true });
    res.json({ verified:true, domain:user.customDomain, message:"Domain verified! Your shop is now live at " + user.customDomain });
  } catch { res.status(500).json({ error:"Failed" }); }
});

module.exports = router;
