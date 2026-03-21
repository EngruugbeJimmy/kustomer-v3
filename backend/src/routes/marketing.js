const express  = require("express");
const axios    = require("axios");
const { Resend } = require("resend");
const Campaign = require("../models/Campaign");
const Customer = require("../models/Customer");
const User     = require("../models/User");
const auth     = require("../middleware/auth");
const router   = express.Router();
router.use(auth);

const resend = new Resend(process.env.RESEND_API_KEY);

// ── GET /api/marketing/history ────────────────────────────────
router.get("/history", async (req, res) => {
  try {
    const campaigns = await Campaign.find({ owner: req.user._id })
      .sort({ createdAt: -1 }).limit(30).lean();
    res.json({ campaigns });
  } catch { res.status(500).json({ error:"Failed" }); }
});

// ── GET /api/marketing/stats ──────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const stats = await Campaign.aggregate([
      { $match: { owner: req.user._id } },
      { $group: { _id:"$channel", count:{ $sum:1 }, totalReach:{ $sum:"$recipientCount" } } }
    ]);
    res.json({ stats });
  } catch { res.status(500).json({ error:"Failed" }); }
});

// ── POST /api/marketing/whatsapp ──────────────────────────────
// Records the broadcast — actual sending is client-side via wa.me
router.post("/whatsapp", async (req, res) => {
  try {
    const { message, recipients, includeLink } = req.body;
    if (!message?.trim()) return res.status(400).json({ error:"Message required" });
    const count = recipients?.length || 0;
    if (req.user.credits < count)
      return res.status(402).json({ error:"Not enough credits", credits: req.user.credits });
    await User.findByIdAndUpdate(req.user._id, { $inc:{ credits:-count, creditsUsed:count } });
    const campaign = await Campaign.create({
      owner: req.user._id, channel:"whatsapp",
      message: message.trim(), recipientCount: count,
      creditsUsed: count,
      recipients: recipients?.map(r => ({ name:r.name, phone:r.phone })) || []
    });
    res.status(201).json({ campaign, creditsRemaining: req.user.credits - count });
  } catch { res.status(500).json({ error:"Failed" }); }
});

// ── POST /api/marketing/sms ───────────────────────────────────
router.post("/sms", async (req, res) => {
  try {
    const { message, recipients } = req.body;
    if (!message?.trim()) return res.status(400).json({ error:"Message required" });
    if (!recipients?.length) return res.status(400).json({ error:"No recipients" });
    // Check plan allows SMS
    const plan = User.PLANS[req.user.plan];
    if (!plan || plan.smsCredits === 0)
      return res.status(402).json({ error:"Upgrade to Starter or higher for SMS" });
    if (req.user.smsCredits < recipients.length)
      return res.status(402).json({ error:"Not enough SMS credits. Top up first." });

    // Send via Termii
    const results = [];
    for (const r of recipients) {
      try {
        await axios.post("https://api.ng.termii.com/api/sms/send", {
          to:       r.phone,
          from:     process.env.TERMII_SENDER_ID || "Kustomer",
          sms:      message.trim(),
          type:     "plain",
          channel:  "dnd",
          api_key:  process.env.TERMII_API_KEY
        });
        results.push({ phone:r.phone, status:"sent" });
      } catch {
        results.push({ phone:r.phone, status:"failed" });
      }
    }
    const sentCount = results.filter(r => r.status === "sent").length;
    await User.findByIdAndUpdate(req.user._id, { $inc:{ smsCredits: -sentCount } });
    await Campaign.create({
      owner: req.user._id, channel:"sms",
      message: message.trim(), recipientCount: sentCount,
      creditsUsed: sentCount,
      recipients: recipients.map(r => ({ name:r.name, phone:r.phone }))
    });
    res.json({ sent: sentCount, failed: recipients.length - sentCount, results });
  } catch (e) { res.status(500).json({ error:"SMS failed: " + e.message }); }
});

// ── POST /api/marketing/email ─────────────────────────────────
router.post("/email", async (req, res) => {
  try {
    const { subject, message, recipients } = req.body;
    if (!subject?.trim() || !message?.trim()) return res.status(400).json({ error:"Subject and message required" });
    if (!recipients?.length) return res.status(400).json({ error:"No recipients" });
    const plan = User.PLANS[req.user.plan];
    if (!plan || plan.emailCredits === 0)
      return res.status(402).json({ error:"Upgrade to Starter or higher for email" });
    if (req.user.emailCredits < recipients.length)
      return res.status(402).json({ error:"Not enough email credits. Top up first." });

    const emailRecips = recipients.filter(r => r.email);
    if (!emailRecips.length) return res.status(400).json({ error:"No customers have email addresses" });

    // Send via Resend
    const { data, error } = await resend.batch.send(
      emailRecips.map(r => ({
        from:    process.env.EMAIL_FROM || "hello@kustomer.app",
        to:      [r.email],
        subject: subject.trim(),
        html:    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#0a7a4b">${req.user.name}</h2>
          <p>${message.trim().replace(/\n/g,"<br>")}</p>
          <hr>
          <p style="font-size:12px;color:#888">Sent via Kustomer · <a href="#">Unsubscribe</a></p>
        </div>`
      }))
    );
    if (error) throw new Error(error.message);

    const sentCount = emailRecips.length;
    await User.findByIdAndUpdate(req.user._id, { $inc:{ emailCredits: -sentCount } });
    await Campaign.create({
      owner: req.user._id, channel:"email",
      subject: subject.trim(), message: message.trim(),
      recipientCount: sentCount, creditsUsed: sentCount,
      recipients: emailRecips.map(r => ({ name:r.name, email:r.email }))
    });
    res.json({ sent: sentCount, message:"Emails sent successfully!" });
  } catch (e) { res.status(500).json({ error:"Email failed: " + e.message }); }
});

// ── POST /api/marketing/social-post ──────────────────────────
// Generates post content via Claude API for any social channel
// Actual posting is manual — user copies the generated text/caption
router.post("/social-post", async (req, res) => {
  try {
    const { channel, productId, customMessage } = req.body;
    const validChannels = ["status","tiktok","facebook","instagram"];
    if (!validChannels.includes(channel))
      return res.status(400).json({ error:"Invalid channel" });

    let context = customMessage || "";

    // If product provided, get product details for AI
    if (productId) {
      const Product = require("../models/Product");
      const product = await Product.findOne({ _id:productId, owner:req.user._id });
      if (product) {
        context = `Product: ${product.name}. Price: ${product.currency}${product.price}. ${product.description || ""}`;
      }
    }

    const channelGuides = {
      status:    "WhatsApp Status (max 700 chars, casual friendly tone, add 2-3 relevant emojis, ends with a call to action)",
      tiktok:    "TikTok caption (punchy, 150 chars max, trending hashtags for Nigerian/African market, hook in first 3 words)",
      facebook:  "Facebook post (conversational, 200-300 chars, 3 relevant hashtags, clear call to action)",
      instagram: "Instagram caption (engaging, 150 chars main text + 5 relevant hashtags on new lines, lifestyle tone)",
    };

    const prompt = `You are a marketing copywriter for African small businesses. 
Write a ${channelGuides[channel]} for this shop: ${req.user.name}.
${context ? "Product/Message: " + context : "General shop promotion."}
Shop catalog: ${process.env.APP_URL}/shop/${req.user.shopSlug}
Return ONLY the post text, nothing else. No explanations.`;

    const aiRes = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{ role:"user", content: prompt }]
    }, {
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      }
    });

    const generatedText = aiRes.data.content[0]?.text || "";

    // Log as draft campaign
    await Campaign.create({
      owner: req.user._id, channel,
      message: generatedText, recipientCount:0,
      creditsUsed:0, status:"draft"
    });

    res.json({ text: generatedText, channel });
  } catch (e) { res.status(500).json({ error:"Generation failed: " + e.message }); }
});


// ── POST /api/marketing/social-multi ─────────────────────────
// Generate captions for multiple platforms in one call — FREE
router.post("/social-multi", auth, async (req, res) => {
  try {
    const { platforms, productId, prompt } = req.body;
    if (!platforms?.length) return res.status(400).json({ error:"Select at least one platform" });

    let product = null;
    if (productId) {
      product = await require("../models/Product").findOne({ _id:productId, owner:req.user._id });
    }

    const platformStyles = {
      tiktok:    "TikTok: short punchy hook under 150 chars, ends with call to action and 4-5 trending Nigerian hashtags",
      instagram: "Instagram: lifestyle tone, 2-3 sentences, ends with 5 relevant hashtags, warm and visual language",
      facebook:  "Facebook: conversational and friendly, 2-4 sentences, no hashtags needed, ends with WhatsApp order prompt",
      twitter:   "X/Twitter: under 240 characters, punchy and direct, 1-2 hashtags max",
      whatsapp:  "WhatsApp Status: short 1-2 sentences max, ends with shop catalog link placeholder [LINK]",
    };

    const platformInstructions = platforms
      .filter(p => platformStyles[p])
      .map(p => `${p}: ${platformStyles[p]}`)
      .join("\n");

    const shopInfo = `Shop: ${req.user.name}`;
    const productInfo = product
      ? `Product: ${product.name} — ${product.currency}${product.price}`
      : "General shop promotion";
    const extraPrompt = prompt ? `Direction: ${prompt}` : "";

    const aiPrompt = `You are a social media copywriter for Nigerian small businesses.
Write captions for these platforms:

${shopInfo}
${productInfo}
${extraPrompt}

Platform requirements:
${platformInstructions}

Return ONLY a JSON object with platform keys and caption values. No markdown, no explanation.
Example: {"tiktok":"caption here","instagram":"caption here"}

Make all captions feel authentic to Nigerian market culture. Use Naija energy where appropriate.`;

    const axios = require("axios");
    const aiRes = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role:"user", content: aiPrompt }]
    }, {
      headers: {
        "x-api-key":          process.env.ANTHROPIC_API_KEY,
        "anthropic-version":  "2023-06-01",
        "content-type":       "application/json"
      }
    });

    const raw   = aiRes.data.content[0]?.text || "{}";
    const clean = raw.replace(/```json|```/g,"").trim();
    const captions = JSON.parse(clean);

    res.json({ captions, platforms });
  } catch (e) {
    res.status(500).json({ error:"Caption generation failed: " + e.message });
  }
});

module.exports = router;
