/**
 * Kustomer AI Agent Scheduler
 * Runs two daily jobs:
 *   07:00 — generate daily brief for every active shop
 *   18:00 — send clicker follow-ups for every active shop
 */
const cron    = require("node-cron");
const axios   = require("axios");
const User    = require("../models/User");
const Product = require("../models/Product");
const Customer= require("../models/Customer");
const CatalogVisit = require("../models/CatalogVisit");
const Order   = require("../models/Order");
const DailyBrief   = require("../models/DailyBrief");
const { deductCredits } = require("../middleware/credits");
const { logger } = require("../middleware/logger");

const APP_URL = process.env.APP_URL || "http://localhost:5000";

// ── Claude API call helper ────────────────────────────────────
const callClaude = async (prompt) => {
  const res = await axios.post("https://api.anthropic.com/v1/messages", {
    model:      "claude-sonnet-4-20250514",
    max_tokens: 1200,
    messages:   [{ role:"user", content: prompt }]
  }, {
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json"
    }
  });
  const raw = res.data.content[0]?.text || "{}";
  return JSON.parse(raw.replace(/```json|```/g,"").trim());
};

// ── Today's date string ───────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

// ════════════════════════════════════════════════════════════════
// JOB 1 — 7:00am — Generate daily brief for every active shop
// ════════════════════════════════════════════════════════════════
const generateDailyBriefs = async () => {
  logger.info("Daily brief job started");
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn("ANTHROPIC_API_KEY not set — skipping daily brief generation");
    return;
  }

  const dateStr = today();

  // Get all active shops that have at least 1 product and 1 customer
  const shops = await User.find({ accountStatus:"active" }).lean();

  let generated = 0;
  let skipped   = 0;

  for (const shop of shops) {
    try {
      // Skip if brief already exists for today
      const existing = await DailyBrief.findOne({ shop:shop._id, date:dateStr });
      if (existing) { skipped++; continue; }

      // Skip if no Anthropic credits / user has 0 balance and 0 daily credits
      const totalCredits = (shop.credits || 0) + (shop.dailyCredits || 0);
      // Brief costs 5 credits — skip if insufficient (don't auto-deduct without approval)

      // Get shop's products
      const products = await Product.find({ owner:shop._id, inStock:true }).lean();
      if (!products.length) { skipped++; continue; }

      // Get shop's customer count
      const customerCount = await Customer.countDocuments({ owner:shop._id });
      if (customerCount === 0) { skipped++; continue; }

      // Get recent performance data
      const last7days = new Date(Date.now() - 7*24*60*60*1000);
      const [recentOrders, recentVisits, hotBuyers] = await Promise.all([
        Order.find({ shop:shop._id, status:"confirmed", createdAt:{ $gt:last7days } })
          .sort({ createdAt:-1 }).limit(10).lean(),
        CatalogVisit.countDocuments({ shop:shop._id, createdAt:{ $gt:last7days } }),
        Customer.countDocuments({ owner:shop._id, buyerTag:"hot" }),
      ]);

      // Find best product to promote today
      // If we have order data, pick most ordered. Otherwise pick first product.
      const productSales = {};
      recentOrders.forEach(o => {
        (o.items||[]).forEach(item => {
          productSales[item.name] = (productSales[item.name] || 0) + (item.qty || 1);
        });
      });
      let bestProduct = products[0];
      if (Object.keys(productSales).length > 0) {
        const bestName = Object.entries(productSales).sort((a,b) => b[1]-a[1])[0][0];
        const found    = products.find(p => p.name === bestName);
        if (found) bestProduct = found;
      }

      // Build insight string
      const insight = recentOrders.length > 0
        ? `${recentOrders.length} orders in last 7 days. ${recentVisits} catalog visits. ${hotBuyers} hot buyers. Best seller: ${bestProduct.name}.`
        : `New shop with ${customerCount} customers and ${products.length} products. First broadcast opportunity.`;

      const catalogUrl = `${process.env.FRONTEND_URL || "https://kustomer.app"}/shop/${shop.shopSlug}`;

      // Call Claude to draft all content
      const prompt = `You are the AI marketing agent for a Nigerian small business called "${shop.name}".

Shop data:
- Products: ${products.slice(0,5).map(p => `${p.name} (${p.currency}${p.price})`).join(", ")}
- Today's featured product: ${bestProduct.name} — ${bestProduct.currency}${bestProduct.price}
- Shop catalog: ${catalogUrl}
- Performance: ${insight}

Write today's marketing content. Return ONLY a JSON object with these exact keys:

{
  "waMessage": "WhatsApp broadcast message (2-3 sentences, warm Naija tone, ends with catalog link)",
  "waStatus": "WhatsApp Status text (1-2 sentences max, very punchy)",
  "facebook": "Facebook post (3-4 sentences, conversational, good morning energy, ends with link)",
  "instagram": "Instagram caption (2-3 sentences + 5 Nigerian hashtags)",
  "tiktok": "TikTok caption (1 punchy hook sentence + 4 hashtags)",
  "insight": "One sentence explaining why you chose this product to promote today"
}

Make all content feel authentic to Lagos/Nigeria market. Use the catalog URL ${catalogUrl} in waMessage and facebook posts.`;

      const content = await callClaude(prompt);

      // Create the daily brief
      await DailyBrief.create({
        shop:        shop._id,
        date:        dateStr,
        status:      "draft",
        product:     bestProduct._id,
        productName: bestProduct.name,
        waMessage:   content.waMessage  || "",
        waStatus:    content.waStatus   || "",
        facebook:    content.facebook   || "",
        instagram:   content.instagram  || "",
        tiktok:      content.tiktok     || "",
        insight:     content.insight    || insight,
      });

      generated++;
      logger.info("Daily brief generated", { shopId:shop._id, shop:shop.name, product:bestProduct.name });

      // Small delay between shops to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      logger.error("Brief generation failed for shop", { shopId:shop._id, error:err.message });
    }
  }

  logger.info("Daily brief job complete", { generated, skipped });
};

// ════════════════════════════════════════════════════════════════
// JOB 2 — 6:00pm — Send clicker follow-ups
// ════════════════════════════════════════════════════════════════
const sendClickerFollowUps = async () => {
  logger.info("Clicker follow-up job started");
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn("ANTHROPIC_API_KEY not set — skipping clicker follow-ups");
    return;
  }

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const todayEnd = new Date();
  todayEnd.setHours(23,59,59,999);

  // Get all shops with active accounts
  const shops = await User.find({ accountStatus:"active" }).lean();

  let processed = 0;

  for (const shop of shops) {
    try {
      // Find customers who visited catalog today but did not order
      const todaysVisits = await CatalogVisit.find({
        shop:      shop._id,
        createdAt: { $gte:todayStart, $lte:todayEnd },
        orderedAt: null,   // did not order
        customer:  { $ne:null }, // must be a known customer
      }).distinct("customer");

      if (!todaysVisits.length) continue;

      // Get customer details
      const clickers = await Customer.find({
        _id:   { $in: todaysVisits },
        owner: shop._id,
      }).lean();

      if (!clickers.length) continue;

      // Check shop has enough credits for follow-ups
      const freshShop = await User.findById(shop._id);
      const available = (freshShop.credits||0) + (freshShop.dailyCredits||0);
      if (available < clickers.length) {
        logger.info("Insufficient credits for clicker follow-up", { shopId:shop._id, needed:clickers.length, available });
        continue;
      }

      // Get the product that was most viewed today from this shop
      const recentBrief = await DailyBrief.findOne({ shop:shop._id, date:today() }).lean();
      const productName = recentBrief?.productName || shop.name + " products";
      const catalogUrl  = `${process.env.FRONTEND_URL || "https://kustomer.app"}/shop/${shop.shopSlug}`;

      // Generate follow-up message with Claude
      const prompt = `Write a short friendly WhatsApp follow-up message for a Nigerian shop called "${shop.name}".

The customer browsed their catalog today and looked at ${productName} but did not order.
The message should be warm, not pushy, create gentle urgency, and include this catalog link: ${catalogUrl}

Return ONLY a JSON object: {"message": "the follow-up message here"}

Keep it under 3 sentences. Naija tone. No aggressive sales pressure.`;

      const result = await callClaude(prompt);
      const followUpMsg = result.message || `Hi! You checked out ${productName} earlier today at ${shop.name}. Still interested? Order here: ${catalogUrl}`;

      // Store follow-up record for the shop owner to see
      // We queue these as pending WA broadcasts — owner's WA needs to send them
      // but the message is pre-written and recipient list is ready
      await DailyBrief.findOneAndUpdate(
        { shop:shop._id, date:today() },
        {
          $set: {
            clickerFollowUp:      followUpMsg,
            clickerCount:         clickers.length,
            clickerFollowUpSentAt:new Date(),
          }
        },
        { upsert:false }
      );

      // Deduct credits (1 per clicker)
      await deductCredits(shop._id, "wa_broadcast", clickers.length);

      processed++;
      logger.info("Clicker follow-up queued", { shopId:shop._id, clickers:clickers.length });

      await new Promise(r => setTimeout(r, 300));

    } catch (err) {
      logger.error("Clicker follow-up failed", { shopId:shop._id, error:err.message });
    }
  }

  logger.info("Clicker follow-up job complete", { processed });
};

// ── Register cron jobs ────────────────────────────────────────
const startScheduler = () => {
  // 7:00am every day — generate daily briefs
  cron.schedule("0 7 * * *", async () => {
    try { await generateDailyBriefs(); }
    catch (e) { logger.error("Daily brief cron error", { error:e.message }); }
  }, { timezone:"Africa/Lagos" });

  // 6:00pm every day — clicker follow-ups
  cron.schedule("0 18 * * *", async () => {
    try { await sendClickerFollowUps(); }
    catch (e) { logger.error("Clicker follow-up cron error", { error:e.message }); }
  }, { timezone:"Africa/Lagos" });

  logger.info("AI Agent Scheduler started — 7am briefs, 6pm follow-ups (Lagos time)");
};

module.exports = { startScheduler, generateDailyBriefs, sendClickerFollowUps };
