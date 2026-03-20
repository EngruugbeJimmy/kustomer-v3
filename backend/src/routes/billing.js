const express  = require("express");
const axios    = require("axios");
const { v4:uuidv4 } = require("uuid");
const User     = require("../models/User");
const Transaction = require("../models/Transaction");
const ResellerSale = require("../models/ResellerSale");
const auth     = require("../middleware/auth");
const router   = express.Router();
const PS_KEY   = process.env.PAYSTACK_SECRET_KEY;
const APP_URL  = process.env.APP_URL || "http://localhost:5000";

// ── Plans (Africa-optimised pricing) ─────────────────────────
// Paystack amounts are in kobo (₦1 = 100 kobo)
const PLANS = {
  starter:  { name:"Starter",  price:150000,  credits:200,  smsCredits:50,   emailCredits:200,  label:"₦1,500/mo" },
  pro:      { name:"Pro",      price:350000,  credits:500,  smsCredits:200,  emailCredits:1000, label:"₦3,500/mo" },
  reseller: { name:"Reseller", price:500000,  credits:1000, smsCredits:500,  emailCredits:2000, label:"₦5,000/mo" },
};

// ── WhatsApp / SMS / Email credit packs ───────────────────────
const CREDIT_PACKS = {
  wa100:    { type:"wa",    sends:100,  price:40000,  label:"100 WA sends",   perUnit:"₦4/send" },
  wa500:    { type:"wa",    sends:500,  price:150000, label:"500 WA sends",   perUnit:"₦3/send" },
  wa2000:   { type:"wa",    sends:2000, price:500000, label:"2,000 WA sends", perUnit:"₦2.50/send" },
  sms100:   { type:"sms",  sends:100,  price:80000,  label:"100 SMS",         perUnit:"₦8/SMS" },
  sms500:   { type:"sms",  sends:500,  price:350000, label:"500 SMS",         perUnit:"₦7/SMS" },
  email500: { type:"email",sends:500,  price:60000,  label:"500 emails",      perUnit:"₦1.20/email" },
  email2000:{ type:"email",sends:2000, price:200000, label:"2,000 emails",    perUnit:"₦1/email" },
};

// ── YouTube video credit packs ────────────────────────────────
// Cost to produce 1 video: ~₦255 (Claude API + TTS + FFmpeg)
// Price to user:  ₦500 for 1 — removes all risk, still 96% margin
const VIDEO_PACKS = {
  vid1:  { videos:1,  price:50000,  label:"1 video",   perUnit:"₦500/video",  tag:"Try it" },
  vid3:  { videos:3,  price:120000, label:"3 videos",  perUnit:"₦400/video",  tag:"Starter" },
  vid10: { videos:10, price:350000, label:"10 videos", perUnit:"₦350/video",  tag:"Growth" },
  vid30: { videos:30, price:900000, label:"30 videos", perUnit:"₦300/video",  tag:"Agency" },
};

router.get("/plans", (_, res) => res.json({ plans:PLANS, credits:CREDIT_PACKS, videos:VIDEO_PACKS }));
router.get("/me", auth, async (req, res) => {
  try { res.json({ user:req.user, transactions: await Transaction.find({ user:req.user._id }).sort({ createdAt:-1 }).limit(10).lean() }); }
  catch { res.status(500).json({ error:"Failed" }); }
});

const initPaystack = async (req, res, type, amount, meta) => {
  const ref = type.slice(0,3) + "_" + uuidv4().replace(/-/g,"").slice(0,16);
  await Transaction.create({ user:req.user._id, type, amount, reference:ref, status:"pending", meta });
  const psr = await axios.post("https://api.paystack.co/transaction/initialize",
    { email:req.user.email, amount, reference:ref, callback_url:APP_URL+"/api/billing/verify/"+ref, metadata:{ userId:req.user._id.toString(), ...meta } },
    { headers:{ Authorization:"Bearer "+PS_KEY } }
  );
  return psr.data.data.authorization_url;
};

router.post("/subscribe", auth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error:"Invalid plan" });
    const url = await initPaystack(req, res, "subscription", PLANS[plan].price, { plan });
    res.json({ authorization_url:url });
  } catch (e) { res.status(500).json({ error:"Payment init failed" }); }
});

router.post("/buy-credits", auth, async (req, res) => {
  try {
    const { pack } = req.body;
    if (!CREDIT_PACKS[pack]) return res.status(400).json({ error:"Invalid pack" });
    const url = await initPaystack(req, res, "credits", CREDIT_PACKS[pack].price, { pack, sends:CREDIT_PACKS[pack].sends });
    res.json({ authorization_url:url });
  } catch { res.status(500).json({ error:"Payment init failed" }); }
});


router.post("/buy-video-credits", auth, async (req, res) => {
  try {
    const { pack } = req.body;
    if (!VIDEO_PACKS[pack]) return res.status(400).json({ error:"Invalid pack" });
    const p = VIDEO_PACKS[pack];
    const url = await initPaystack(req, res, "video_credits", p.price, { pack, videos:p.videos });
    res.json({ authorization_url:url });
  } catch { res.status(500).json({ error:"Payment init failed" }); }
});

router.get("/verify/:ref", async (req, res) => {
  try {
    const psr = await axios.get("https://api.paystack.co/transaction/verify/"+req.params.ref, { headers:{ Authorization:"Bearer "+PS_KEY } });
    if (psr.data.data.status !== "success") return res.redirect(process.env.FRONTEND_URL+"/billing?status=failed");
    const tx = await Transaction.findOneAndUpdate({ reference:req.params.ref }, { status:"success" }, { new:true });
    if (!tx) return res.redirect(process.env.FRONTEND_URL+"/billing?status=error");
    const user = await User.findById(tx.user);
    if (!user) return res.redirect(process.env.FRONTEND_URL+"/billing?status=error");
    if (tx.type === "subscription") {
      const p = PLANS[tx.meta.plan];
      const expires = new Date(); expires.setMonth(expires.getMonth()+1);
      await User.findByIdAndUpdate(user._id, { plan:tx.meta.plan, credits:(user.credits||0)+p.credits, smsCredits:(user.smsCredits||0)+p.smsCredits, emailCredits:(user.emailCredits||0)+p.emailCredits, planExpiresAt:expires });
      if (user.referredBy) {
        const commission = Math.round(p.price*0.30);
        await ResellerSale.create({ reseller:user.referredBy, shop:user._id, shopName:user.name, plan:tx.meta.plan, amount:p.price, commission });
        await User.findByIdAndUpdate(user.referredBy, { $inc:{ resellerEarnings:commission } });
      }
    } else if (tx.type === "credits") {
      await User.findByIdAndUpdate(user._id, { $inc:{ credits:tx.meta.sends } });
    } else if (tx.type === "video_credits") {
      await User.findByIdAndUpdate(user._id, { $inc:{ videoCredits:tx.meta.videos } });
    }
    res.redirect(process.env.FRONTEND_URL+"/billing?status=success");
  } catch { res.redirect(process.env.FRONTEND_URL+"/billing?status=error"); }
});

module.exports = router;
