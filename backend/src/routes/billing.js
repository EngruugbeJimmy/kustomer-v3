const express  = require("express");
const axios    = require("axios");
const { v4:uuidv4 } = require("uuid");
const User        = require("../models/User");
const Transaction = require("../models/Transaction");
const auth        = require("../middleware/auth");
const { ensureDailyCredits, COSTS, DAILY_CREDIT_AMOUNT } = require("../middleware/credits");
const router      = express.Router();

const PS_KEY  = process.env.PAYSTACK_SECRET_KEY;
const APP_URL = process.env.APP_URL || "http://localhost:5000";

// ── Credit packs — airtime style, one currency ────────────────
const CREDIT_PACKS = {
  starter: { credits:50,   price:20000,  label:"50 credits",   naira:"₦200",   tag:"Try it" },
  small:   { credits:150,  price:50000,  label:"150 credits",  naira:"₦500",   tag:"Popular" },
  medium:  { credits:400,  price:120000, label:"400 credits",  naira:"₦1,200", tag:"Best value" },
  large:   { credits:1000, price:250000, label:"1,000 credits",naira:"₦2,500", tag:"Growth" },
  bulk:    { credits:3000, price:600000, label:"3,000 credits",naira:"₦6,000", tag:"Agency" },
};

// ── What each credit buys ─────────────────────────────────────
const CREDIT_GUIDE = {
  "WhatsApp broadcast": "1 credit per customer",
  "SMS":                "3 credits per customer",
  "Email":              "1 credit per customer",
  "AI SEO":             "5 credits per product",
  "Social post":        "3 credits per caption",
  "YouTube script":     "10 credits",
  "YouTube video":      "40 credits (script + render + publish)",
};

// ── GET /api/billing/status ───────────────────────────────────
router.get("/status", auth, async (req, res) => {
  try {
    const user = await ensureDailyCredits(req.user);
    const txs  = await Transaction.find({ user: user._id })
      .sort({ createdAt:-1 }).limit(10).lean();
    res.json({
      credits:       user.credits || 0,
      dailyCredits:  user.dailyCredits || 0,
      totalAvailable:(user.credits || 0) + (user.dailyCredits || 0),
      totalUsed:     user.totalCreditsUsed || 0,
      totalBought:   user.totalCreditsBought || 0,
      dailyReset:    "Midnight every day",
      dailyAmount:   DAILY_CREDIT_AMOUNT,
      packs:         CREDIT_PACKS,
      guide:         CREDIT_GUIDE,
      transactions:  txs,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/billing/packs ────────────────────────────────────
router.get("/packs", (_, res) => res.json({ packs: CREDIT_PACKS, guide: CREDIT_GUIDE, daily: DAILY_CREDIT_AMOUNT }));

// ── POST /api/billing/topup ───────────────────────────────────
router.post("/topup", auth, async (req, res) => {
  try {
    const { pack } = req.body;
    if (!CREDIT_PACKS[pack]) return res.status(400).json({ error: "Invalid pack" });

    const p   = CREDIT_PACKS[pack];
    const ref = "kc_" + uuidv4().replace(/-/g,"").slice(0,16);

    await Transaction.create({
      user:      req.user._id,
      type:      "topup",
      amount:    p.price,
      reference: ref,
      status:    "pending",
      meta:      { pack, credits: p.credits, naira: p.naira },
    });

    const psr = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email:        req.user.email,
        amount:       p.price,
        reference:    ref,
        callback_url: APP_URL + "/api/billing/verify/" + ref,
        metadata:     { userId: req.user._id.toString(), pack, credits: p.credits },
      },
      { headers: { Authorization: "Bearer " + PS_KEY } }
    );

    res.json({ authorization_url: psr.data.data.authorization_url, ref, pack: p });
  } catch (e) {
    res.status(500).json({ error: "Payment initialisation failed. Please try again." });
  }
});

// ── GET /api/billing/verify/:ref ─────────────────────────────
router.get("/verify/:ref", async (req, res) => {
  const FRONTEND = process.env.FRONTEND_URL || "http://localhost:3000";
  try {
    const psr = await axios.get(
      "https://api.paystack.co/transaction/verify/" + req.params.ref,
      { headers: { Authorization: "Bearer " + PS_KEY } }
    );

    const data = psr.data.data;
    if (data.status !== "success") {
      await Transaction.findOneAndUpdate({ reference: req.params.ref }, { status: "failed" });
      return res.redirect(FRONTEND + "/billing?status=failed");
    }

    const tx = await Transaction.findOneAndUpdate(
      { reference: req.params.ref, status: "pending" },
      { status: "success" },
      { new: true }
    );
    if (!tx) return res.redirect(FRONTEND + "/billing?status=already");

    const { credits } = tx.meta;

    // Add credits to purchased balance
    await User.findByIdAndUpdate(tx.user, {
      $inc: {
        credits:             credits,
        totalCreditsBought:  credits,
      }
    });

    res.redirect(FRONTEND + "/billing?status=success&credits=" + credits);
  } catch (e) {
    res.redirect(FRONTEND + "/billing?status=failed");
  }
});

// ── POST /api/billing/webhook ─────────────────────────────────
// Paystack webhook fallback
router.post("/webhook", async (req, res) => {
  try {
    const event = req.body;
    if (event.event === "charge.success") {
      const ref = event.data?.reference;
      if (!ref) return res.sendStatus(200);
      const tx = await Transaction.findOne({ reference: ref, status: "pending" });
      if (!tx) return res.sendStatus(200);
      await Transaction.findByIdAndUpdate(tx._id, { status: "success" });
      await User.findByIdAndUpdate(tx.user, {
        $inc: { credits: tx.meta.credits, totalCreditsBought: tx.meta.credits }
      });
    }
    res.sendStatus(200);
  } catch { res.sendStatus(200); }
});

module.exports = router;
