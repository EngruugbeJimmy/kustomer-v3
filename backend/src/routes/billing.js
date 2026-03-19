const express     = require("express");
const axios       = require("axios");
const { v4: uuidv4 } = require("uuid");
const User        = require("../models/User");
const Transaction = require("../models/Transaction");
const ResellerSale= require("../models/ResellerSale");
const auth        = require("../middleware/auth");
const router      = express.Router();

const PS_KEY  = process.env.PAYSTACK_SECRET_KEY;
const APP_URL = process.env.APP_URL || "http://localhost:5000";

const PLANS = {
  starter: { name: "Starter", price: 250000, credits: 500, customerLimit: 300 },
  pro:     { name: "Pro",     price: 650000, credits: 2000, customerLimit: -1 },
};

const CREDIT_PACKS = {
  pack100:  { sends: 100,  price: 50000,  label: "100 sends" },
  pack500:  { sends: 500,  price: 200000, label: "500 sends" },
  pack1000: { sends: 1000, price: 350000, label: "1,000 sends" },
  pack5000: { sends: 5000, price: 1500000,label: "5,000 sends" },
};

// GET /api/billing/plans
router.get("/plans", (req, res) => res.json({ plans: PLANS, credits: CREDIT_PACKS }));

// GET /api/billing/me
router.get("/me", auth, async (req, res) => {
  try {
    const txs = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 }).limit(10).lean();
    res.json({ user: req.user, transactions: txs });
  } catch { res.status(500).json({ error: "Failed" }); }
});

// POST /api/billing/subscribe  { plan: "starter"|"pro" }
router.post("/subscribe", auth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: "Invalid plan" });
    const planData = PLANS[plan];
    const ref = "sub_" + uuidv4().replace(/-/g,"").slice(0,16);
    const tx = await Transaction.create({
      user: req.user._id, type: "subscription",
      amount: planData.price, plan, reference: ref,
      status: "pending", meta: { plan, credits: planData.credits }
    });
    const payload = {
      email:     req.user.email,
      amount:    planData.price,
      reference: ref,
      callback_url: APP_URL + "/api/billing/verify/" + ref,
      metadata: { userId: req.user._id.toString(), type: "subscription", plan }
    };
    const psRes = await axios.post("https://api.paystack.co/transaction/initialize", payload,
      { headers: { Authorization: "Bearer " + PS_KEY, "Content-Type": "application/json" } });
    res.json({ authorization_url: psRes.data.data.authorization_url, reference: ref });
  } catch (e) { res.status(500).json({ error: "Payment init failed: " + e.message }); }
});

// POST /api/billing/buy-credits  { pack: "pack100"|"pack500"|... }
router.post("/buy-credits", auth, async (req, res) => {
  try {
    const { pack } = req.body;
    if (!CREDIT_PACKS[pack]) return res.status(400).json({ error: "Invalid pack" });
    const packData = CREDIT_PACKS[pack];
    const ref = "crd_" + uuidv4().replace(/-/g,"").slice(0,16);
    await Transaction.create({
      user: req.user._id, type: "credits",
      amount: packData.price, credits: packData.sends,
      reference: ref, status: "pending",
      meta: { pack, sends: packData.sends }
    });
    const payload = {
      email:     req.user.email,
      amount:    packData.price,
      reference: ref,
      callback_url: APP_URL + "/api/billing/verify/" + ref,
      metadata: { userId: req.user._id.toString(), type: "credits", sends: packData.sends }
    };
    const psRes = await axios.post("https://api.paystack.co/transaction/initialize", payload,
      { headers: { Authorization: "Bearer " + PS_KEY, "Content-Type": "application/json" } });
    res.json({ authorization_url: psRes.data.data.authorization_url, reference: ref });
  } catch (e) { res.status(500).json({ error: "Payment init failed: " + e.message }); }
});

// GET /api/billing/verify/:ref  (Paystack callback)
router.get("/verify/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    const psRes = await axios.get("https://api.paystack.co/transaction/verify/" + ref,
      { headers: { Authorization: "Bearer " + PS_KEY } });
    const data = psRes.data.data;
    if (data.status !== "success") {
      return res.redirect(process.env.FRONTEND_URL + "/billing?status=failed");
    }
    const tx = await Transaction.findOneAndUpdate({ reference: ref }, { status: "success", paystackRef: data.id }, { new: true });
    if (!tx) return res.redirect(process.env.FRONTEND_URL + "/billing?status=error");
    const user = await User.findById(tx.user);
    if (!user) return res.redirect(process.env.FRONTEND_URL + "/billing?status=error");

    if (tx.type === "subscription") {
      const planData = PLANS[tx.plan];
      const expires  = new Date(); expires.setMonth(expires.getMonth() + 1);
      user.plan           = tx.plan;
      user.credits        = (user.credits || 0) + planData.credits;
      user.planExpiresAt  = expires;
      await user.save();
      // If referred, log reseller commission (30% of plan price)
      if (user.referredBy) {
        const commission = Math.round(planData.price * 0.30);
        await ResellerSale.create({
          reseller: user.referredBy, shop: user._id,
          shopName: user.name, plan: tx.plan,
          amount: planData.price, commission
        });
        await User.findByIdAndUpdate(user.referredBy, { $inc: { resellerEarnings: commission } });
      }
    } else if (tx.type === "credits") {
      user.credits = (user.credits || 0) + tx.credits;
      await user.save();
    }

    res.redirect(process.env.FRONTEND_URL + "/billing?status=success");
  } catch (e) { res.redirect(process.env.FRONTEND_URL + "/billing?status=error"); }
});

// POST /api/billing/use-credits  (internal — called when broadcasting)
router.post("/use-credits", auth, async (req, res) => {
  try {
    const { count } = req.body;
    const user = req.user;
    const plan = User.PLANS[user.plan] || User.PLANS.free;
    // Check limit
    if (user.credits < count) return res.status(402).json({ error: "Not enough credits", credits: user.credits });
    await User.findByIdAndUpdate(user._id, { $inc: { credits: -count, creditsUsed: count } });
    res.json({ ok: true, remaining: user.credits - count });
  } catch { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
