const express = require("express");
const jwt     = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User    = require("../models/User");
const auth    = require("../middleware/auth");
const router  = express.Router();
const tok = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

router.post("/signup", [
  body("name").trim().notEmpty(),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
], async (req, res) => {
  try {
    const err = validationResult(req);
    if (!err.isEmpty()) return res.status(400).json({ error: err.array()[0].msg });
    const { name, email, password, phone, resellerCode } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ error: "Email already registered" });
    const data = { name, email, password, phone };
    if (resellerCode) {
      const reseller = await User.findOne({ resellerCode, isReseller: true });
      if (reseller) data.referredBy = reseller._id;
    }
    const user  = await User.create(data);
    // If referred, log a reseller sale when they upgrade (handled in billing)
    res.status(201).json({ token: tok(user._id), user });
  } catch (e) { res.status(500).json({ error: "Signup failed" }); }
});

router.post("/login", [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty()
], async (req, res) => {
  try {
    const err = validationResult(req);
    if (!err.isEmpty()) return res.status(400).json({ error: err.array()[0].msg });
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: "Invalid email or password" });
    res.json({ token: tok(user._id), user });
  } catch { res.status(500).json({ error: "Login failed" }); }
});

router.get("/me", auth, (req, res) => res.json({ user: req.user }));

router.patch("/shop", auth, async (req, res) => {
  try {
    const { shopDescription, phone } = req.body;
    const upd = {};
    if (shopDescription !== undefined) upd.shopDescription = shopDescription;
    if (phone)            upd.phone = phone;
    const user = await User.findByIdAndUpdate(req.user._id, upd, { new: true });
    localStorage.setItem("kustomer_user", JSON.stringify(user));
    res.json({ user });
  } catch { res.status(500).json({ error: "Update failed" }); }
});

module.exports = router;
