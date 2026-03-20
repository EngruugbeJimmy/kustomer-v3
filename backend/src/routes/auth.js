const express  = require("express");
const jwt      = require("jsonwebtoken");
const crypto   = require("crypto");
const { body, validationResult } = require("express-validator");
const User          = require("../models/User");
const PasswordReset  = require("../models/PasswordReset");
const { Resend }      = require("resend");
const auth     = require("../middleware/auth");
const { logger } = require("../middleware/logger");
const router   = express.Router();

// ── Token generator — never log the output ────────────────────
const makeToken = (id) => jwt.sign(
  { id, iat: Math.floor(Date.now() / 1000) },
  process.env.JWT_SECRET,
  { expiresIn: "30d", algorithm: "HS256" }
);

// ── Generic error for auth failures — same message always ─────
// Prevents username enumeration (knowing which emails are registered)
const AUTH_ERROR = "Invalid email or password";

// ── POST /api/auth/signup ─────────────────────────────────────
router.post("/signup", [
  body("name").trim().notEmpty().withMessage("Name is required").isLength({ max:60 }),
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password")
    .isLength({ min:8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password needs at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Password needs at least one number"),
  body("phone").optional().trim().isLength({ max:20 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { name, email, password, phone, resellerCode } = req.body;

    // Check existing — use timing-safe comparison path
    // Check how many accounts created from this IP in last 24h
    const recentFromIp = await User.countDocuments({
      signupIp: req.ip,
      createdAt: { $gt: new Date(Date.now() - 24*60*60*1000) }
    });
    if (recentFromIp >= 3) {
      logger.warn("Mass account creation attempt", { ip: req.ip });
      return res.status(429).json({ error:"Too many accounts created from this device. Try again tomorrow." });
    }

    const existing = await User.findOne({ email }).select("_id");
    if (existing) return res.status(400).json({ error: "Email already registered" });

    const data = { name, email, password, accountStatus:"active", signupIp: req.ip };
    if (phone) data.phone = phone.replace(/[\s\-()]/g, "");

    if (resellerCode) {
      const referrer = await User.findOne({ resellerCode, isReseller:true }).select("_id");
      if (referrer) data.referredBy = referrer._id;
    }

    const user = await User.create(data);

    // Log signup (no password logged)
    logger.info("New signup", { userId: user._id, email: user.email });

    res.status(201).json({ token: makeToken(user._id), user });
  } catch (err) {
    logger.error("Signup error", { message: err.message });
    res.status(500).json({ error: "Signup failed" });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post("/login", [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: AUTH_ERROR });

    const { email, password } = req.body;

    // Always do the password compare even if user not found
    // This prevents timing attacks that reveal whether an email exists
    const user = await User.findOne({ email }).select("+password");
    const dummyHash = "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234";
    const passwordToCompare = user ? user.password : dummyHash;
    const valid = user ? await user.comparePassword(password) : await require("bcryptjs").compare(password, dummyHash);

    if (!user || !valid) {
      logger.warn("Failed login attempt", { email, ip: req.ip });
      return res.status(401).json({ error: AUTH_ERROR });
    }

    logger.info("Login", { userId: user._id });
    res.json({ token: makeToken(user._id), user });
  } catch (err) {
    logger.error("Login error", { message: err.message });
    res.status(500).json({ error: "Login failed" });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get("/me", auth, (req, res) => res.json({ user: req.user }));

// ── PATCH /api/auth/shop ──────────────────────────────────────
router.patch("/shop", auth, [
  body("shopDescription").optional().trim().isLength({ max:200 }),
  body("phone").optional().trim().isLength({ max:20 }),
  body("category").optional().trim().isLength({ max:50 }),
  body("city").optional().trim().isLength({ max:100 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    // Whitelist — only allow specific fields to be updated
    const allowed = ["shopDescription","phone","category","city","agentBio"];
    const update  = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.user._id, update, { new:true, runValidators:true });
    res.json({ user });
  } catch (err) {
    logger.error("Shop update error", { message: err.message });
    res.status(500).json({ error: "Update failed" });
  }
});

// ── POST /api/auth/change-password ────────────────────────────
router.post("/change-password", auth, [
  body("currentPassword").notEmpty(),
  body("newPassword")
    .isLength({ min:8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Needs uppercase letter")
    .matches(/[0-9]/).withMessage("Needs a number"),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const user = await User.findById(req.user._id).select("+password");
    const valid = await user.comparePassword(req.body.currentPassword);
    if (!valid) return res.status(401).json({ error: "Current password incorrect" });

    user.password = req.body.newPassword;
    await user.save();

    logger.info("Password changed", { userId: user._id });
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    logger.error("Password change error", { message: err.message });
    res.status(500).json({ error: "Failed" });
  }
});


// ── POST /api/auth/forgot-password ────────────────────────────
// Always returns same message — prevents email enumeration
router.post("/forgot-password", authLimiter, [
  body("email").isEmail().normalizeEmail(),
], async (req, res) => {
  const SAFE_MSG = "If that email is registered you will receive a reset link shortly.";
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.json({ message: SAFE_MSG });

    const { email } = req.body;
    const user = await User.findOne({ email }).select("_id name email");

    // Always respond the same — do not reveal if email exists
    if (!user) return res.json({ message: SAFE_MSG });

    // Invalidate any existing reset tokens for this user
    await PasswordReset.deleteMany({ userId: user._id, used: false });

    // Generate a secure random token
    const rawToken  = crypto.randomBytes(32).toString("hex");
    const hashedTok = crypto.createHash("sha256").update(rawToken).digest("hex");

    await PasswordReset.create({
      userId:    user._id,
      token:     hashedTok,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      ip:        req.ip,
    });

    // Build reset URL — goes to frontend
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = FRONTEND_URL + "/reset-password?token=" + rawToken + "&email=" + encodeURIComponent(email);

    // Send email via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from:    process.env.EMAIL_FROM || "Kustomer <hello@kustomer.app>",
          to:      email,
          subject: "Reset your Kustomer password",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="font-size:24px;font-weight:800;color:#0a7a4b;margin:0 0 8px">Reset your password</h2>
              <p style="color:#555;font-size:15px;margin:0 0 24px">Hi ${user.name},</p>
              <p style="color:#555;font-size:15px;margin:0 0 24px">
                Someone requested a password reset for your Kustomer account.
                Click the button below to set a new password. This link expires in 1 hour.
              </p>
              <a href="${resetUrl}"
                 style="display:inline-block;background:#0a7a4b;color:#fff;font-size:15px;font-weight:700;
                        padding:14px 28px;border-radius:12px;text-decoration:none;margin-bottom:24px">
                Reset Password
              </a>
              <p style="color:#999;font-size:13px;margin:0">
                If you did not request this, ignore this email. Your password will not change.
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
              <p style="color:#ccc;font-size:12px;margin:0">Kustomer — Built for African commerce</p>
            </div>
          `,
        });
      } catch (emailErr) {
        logger.error("Password reset email failed", { message: emailErr.message });
        // Still respond success — don't reveal email system errors
      }
    }

    // Dev mode — return token directly so you can test without email
    const response = { message: SAFE_MSG };
    if (process.env.NODE_ENV !== "production") {
      response.devToken  = rawToken;
      response.devResetUrl = resetUrl;
    }

    logger.info("Password reset requested", { userId: user._id });
    res.json(response);
  } catch (e) {
    logger.error("Forgot password error", { message: e.message });
    res.json({ message: "If that email is registered you will receive a reset link shortly." });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────
router.post("/reset-password", authLimiter, [
  body("token").notEmpty().trim(),
  body("email").isEmail().normalizeEmail(),
  body("password")
    .isLength({ min:8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password needs at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Password needs at least one number"),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { token, email, password } = req.body;

    // Hash the incoming token and look it up
    const hashedTok = crypto.createHash("sha256").update(token).digest("hex");
    const user      = await User.findOne({ email }).select("_id");
    if (!user) return res.status(400).json({ error: "Invalid or expired reset link." });

    const record = await PasswordReset.findOne({
      userId:    user._id,
      token:     hashedTok,
      used:      false,
      expiresAt: { $gt: new Date() },
    });

    if (!record) return res.status(400).json({ error: "Reset link is invalid or has expired. Request a new one." });

    // Update password
    user.password = password;
    await user.save(); // triggers bcrypt hash via pre-save hook

    // Mark token as used — can never be reused
    await PasswordReset.findByIdAndUpdate(record._id, { used: true });

    logger.info("Password reset completed", { userId: user._id });
    res.json({ message: "Password updated successfully. You can now log in." });
  } catch (e) {
    logger.error("Reset password error", { message: e.message });
    res.status(500).json({ error: "Password reset failed. Please try again." });
  }
});

module.exports = router;
