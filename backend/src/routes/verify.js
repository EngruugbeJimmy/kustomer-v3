/**
 * Phone OTP verification + shop trust system
 * All zero-cost — uses Termii for OTP (already in stack)
 */
const express          = require("express");
const axios            = require("axios");
const crypto           = require("crypto");
const User             = require("../models/User");
const OtpVerification  = require("../models/OtpVerification");
const ShopReport       = require("../models/ShopReport");
const auth             = require("../middleware/auth");
const { logger }       = require("../middleware/logger");
const { authLimiter }  = require("../middleware/security");
const router           = express.Router();

// ── Helpers ───────────────────────────────────────────────────
const hashOtp  = (otp)  => crypto.createHash("sha256").update(otp + process.env.JWT_SECRET).digest("hex");
const genOtp   = ()     => String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
const OTP_TTL  = 10 * 60 * 1000; // 10 minutes

// Levenshtein distance — checks name similarity
const levenshtein = (a, b) => {
  a = a.toLowerCase().replace(/\s+/g,"");
  b = b.toLowerCase().replace(/\s+/g,"");
  const dp = Array.from({ length:a.length+1 }, (_,i) => [i,...Array(b.length).fill(0)]);
  for (let j=0;j<=b.length;j++) dp[0][j]=j;
  for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++) {
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1]
      : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  }
  return dp[a.length][b.length];
};

// ── POST /api/verify/send-otp ─────────────────────────────────
// Rate limited: 3 OTPs per 15 min per IP (authLimiter)
router.post("/send-otp", authLimiter, auth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone?.trim()) return res.status(400).json({ error:"Phone number required" });

    const cleanPhone = phone.replace(/[\s\-()]/g,"");
    if (!/^\+?[0-9]{10,15}$/.test(cleanPhone)) return res.status(400).json({ error:"Invalid phone number format" });

    // Check if already verified
    if (req.user.phoneVerified) return res.status(400).json({ error:"Phone already verified" });

    // Check if this phone is used by another account
    const existing = await User.findOne({ phone:cleanPhone, _id:{ $ne:req.user._id }, phoneVerified:true });
    if (existing) return res.status(400).json({ error:"This phone number is already registered to another account" });

    // Invalidate any existing OTPs for this phone
    await OtpVerification.deleteMany({ phone:cleanPhone, verified:false });

    const otp = genOtp();

    // Send via Termii
    let otpSent = false;
    if (process.env.TERMII_API_KEY) {
      try {
        await axios.post("https://api.ng.termii.com/api/sms/send", {
          to:      cleanPhone,
          from:    "Kustomer",
          sms:     `Your Kustomer verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
          type:    "plain",
          channel: "dnd",
          api_key: process.env.TERMII_API_KEY
        });
        otpSent = true;
      } catch (err) {
        logger.warn("Termii OTP send failed", { phone:cleanPhone, error:err.message });
      }
    }

    // Store hashed OTP — never store plaintext
    await OtpVerification.create({
      phone:     cleanPhone,
      otp:       hashOtp(otp),
      attempts:  0,
      verified:  false,
      expiresAt: new Date(Date.now() + OTP_TTL),
      userId:    req.user._id,
      ip:        req.ip,
    });

    // In development or if Termii fails, return OTP directly for testing
    const response = { message:"OTP sent to " + cleanPhone.slice(0,-4) + "****" };
    if (!otpSent || process.env.NODE_ENV !== "production") {
      response.otp = otp; // dev only — remove in production
      response.note = "Dev mode: OTP returned directly";
    }

    logger.info("OTP sent", { userId:req.user._id, phone:cleanPhone.slice(0,-4)+"****" });
    res.json(response);
  } catch (e) {
    logger.error("OTP send error", { message:e.message });
    res.status(500).json({ error:"Failed to send OTP" });
  }
});

// ── POST /api/verify/confirm-otp ──────────────────────────────
router.post("/confirm-otp", authLimiter, auth, async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error:"Phone and OTP required" });

    const cleanPhone = phone.replace(/[\s\-()]/g,"");
    const record = await OtpVerification.findOne({
      phone:    cleanPhone,
      verified: false,
      userId:   req.user._id,
      expiresAt:{ $gt: new Date() }
    });

    if (!record) return res.status(400).json({ error:"OTP expired or not found. Request a new one." });

    // Limit wrong attempts — 5 max
    if (record.attempts >= 5) {
      await OtpVerification.deleteOne({ _id:record._id });
      logger.warn("OTP max attempts exceeded", { userId:req.user._id });
      return res.status(400).json({ error:"Too many wrong attempts. Request a new OTP." });
    }

    // Compare hashed OTP
    if (record.otp !== hashOtp(otp.trim())) {
      await OtpVerification.findByIdAndUpdate(record._id, { $inc:{ attempts:1 } });
      const remaining = 4 - record.attempts;
      return res.status(400).json({ error:`Wrong OTP. ${remaining} attempt${remaining!==1?"s":""} remaining.` });
    }

    // Mark OTP as used
    await OtpVerification.findByIdAndUpdate(record._id, { verified:true });

    // Mark user phone as verified + activate account
    await User.findByIdAndUpdate(req.user._id, {
      phone:           cleanPhone,
      phoneVerified:   true,
      phoneVerifiedAt: new Date(),
      accountStatus:   "active",  // upgrades from "pending"
      signupIp:        req.ip,
    });

    logger.info("Phone verified", { userId:req.user._id });
    res.json({ message:"Phone verified! ✅ Your account is now active.", verified:true });
  } catch (e) {
    logger.error("OTP confirm error", { message:e.message });
    res.status(500).json({ error:"Verification failed" });
  }
});

// ── POST /api/verify/check-name ───────────────────────────────
// Called before signup completes — checks name similarity
router.post("/check-name", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error:"Name required" });

    // Get all verified shop names
    const shops = await User.find({ phoneVerified:true })
      .select("name shopSlug").lean();

    const similar = shops.filter(s => {
      const dist = levenshtein(name.trim(), s.name);
      return dist <= 2 && dist > 0; // within 2 chars edit distance but not identical
    });

    if (similar.length > 0) {
      return res.json({
        ok:false,
        warning:true,
        message:`A similar shop name already exists: "${similar[0].name}". Please choose a more unique name to avoid confusion.`,
        similar: similar.map(s => ({ name:s.name, slug:s.shopSlug }))
      });
    }

    res.json({ ok:true, message:"Name is available" });
  } catch (e) {
    res.status(500).json({ error:"Name check failed" });
  }
});

// ── POST /api/verify/request-discover ────────────────────────
// Shop owner requests to be listed in Discover (manual review)
router.post("/request-discover", auth, async (req, res) => {
  try {
    const user = req.user;

    // Must be phone verified first
    if (!user.phoneVerified) {
      return res.status(400).json({
        error:"Verify your phone number first before applying to Discover.",
        action:"verify_phone"
      });
    }

    // Must have at least 1 confirmed order (proves real activity)
    if ((user.confirmedOrders || 0) < 1) {
      return res.status(400).json({
        error:"Complete your first sale before applying to Discover. This proves your shop is active.",
        action:"get_first_order"
      });
    }

    if (user.discoverStatus === "approved") {
      return res.json({ message:"Your shop is already approved on Discover!", status:"approved" });
    }

    if (user.discoverStatus === "pending_review") {
      return res.json({ message:"Your application is under review. We will approve within 24 hours.", status:"pending_review" });
    }

    // Submit for review
    await User.findByIdAndUpdate(user._id, { discoverStatus:"pending_review" });

    logger.info("Discover application", { userId:user._id, shop:user.name });
    res.json({
      message:"Application submitted! Your shop will appear in Discover once reviewed (usually within 24 hours).",
      status:"pending_review"
    });
  } catch (e) {
    res.status(500).json({ error:"Application failed" });
  }
});

// ── POST /api/verify/report-shop ─────────────────────────────
// Customer reports a suspicious shop (public — no auth needed)
router.post("/report-shop", async (req, res) => {
  try {
    const { shopSlug, reason, detail } = req.body;
    if (!shopSlug || !reason) return res.status(400).json({ error:"Shop and reason required" });

    const validReasons = ["fake_shop","scam","impersonation","wrong_info","other"];
    if (!validReasons.includes(reason)) return res.status(400).json({ error:"Invalid reason" });

    const shop = await User.findOne({ shopSlug });
    if (!shop) return res.status(404).json({ error:"Shop not found" });

    // Create report
    await ShopReport.create({
      shop:     shop._id,
      reporter: req.ip,
      reason,
      detail:   (detail||"").slice(0,500),
    });

    // Count reports — auto-pause at 3
    const reportCount = await ShopReport.countDocuments({ shop:shop._id, resolved:false });
    await User.findByIdAndUpdate(shop._id, { reportCount });

    if (reportCount >= 3 && shop.accountStatus === "active") {
      await User.findByIdAndUpdate(shop._id, {
        accountStatus: "warned",
        discoverStatus:"hidden",  // remove from Discover immediately
      });
      logger.warn("Shop auto-warned from reports", { shopId:shop._id, shopName:shop.name, reports:reportCount });
    }

    res.json({ message:"Report submitted. Thank you for keeping Kustomer safe." });
  } catch (e) {
    res.status(500).json({ error:"Report failed" });
  }
});

// ── GET /api/verify/trust-status ─────────────────────────────
// Get own verification and trust status
router.get("/trust-status", auth, async (req, res) => {
  try {
    const user = req.user;

    // Compute trust score (0-100)
    let score = 0;
    if (user.phoneVerified)          score += 40; // biggest signal
    if ((user.confirmedOrders||0) >= 1) score += 20;
    if ((user.confirmedOrders||0) >= 5) score += 15;
    if ((user.confirmedOrders||0) >= 20) score += 15;
    if ((user.reportCount||0) === 0) score += 10;
    if ((user.reportCount||0) > 0)   score -= 20;
    score = Math.max(0, Math.min(100, score));

    // Update stored score
    await User.findByIdAndUpdate(user._id, { trustScore:score });

    res.json({
      phoneVerified:   user.phoneVerified,
      accountStatus:   user.accountStatus,
      discoverStatus:  user.discoverStatus,
      trustScore:      score,
      confirmedOrders: user.confirmedOrders || 0,
      reportCount:     user.reportCount || 0,
      // What they need to unlock each feature
      unlocks: {
        canBroadcast:   user.phoneVerified,
        canBeAgent:     user.phoneVerified,
        canBeInDiscover:user.phoneVerified && (user.confirmedOrders||0) >= 1,
        canSetAgents:   user.phoneVerified && (user.confirmedOrders||0) >= 1,
      }
    });
  } catch (e) {
    res.status(500).json({ error:"Failed" });
  }
});

module.exports = router;
