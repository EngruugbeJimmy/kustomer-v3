/**
 * Kustomer AI Agent Service
 * Runs automatically — shop owner only approves and confirms orders
 */
const axios          = require("axios");
const User           = require("../models/User");
const Product        = require("../models/Product");
const Customer       = require("../models/Customer");
const CatalogVisit   = require("../models/CatalogVisit");
const Order          = require("../models/Order");
const DailyBriefing  = require("../models/DailyBriefing");
const ClickerFollowUp= require("../models/ClickerFollowUp");
const { deductCredits } = require("../middleware/credits");
const { logger }     = require("../middleware/logger");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const APP_URL      = process.env.APP_URL      || "http://localhost:5000";

// ── Call Claude ───────────────────────────────────────────────
const callClaude = async (prompt, maxTokens = 1500) => {
  const res = await axios.post("https://api.anthropic.com/v1/messages", {
    model:      "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    messages:   [{ role:"user", content: prompt }]
  }, {
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json"
    }
  });
  return res.data.content[0]?.text || "";
};

// ── Pick best product to promote today ───────────────────────
const pickBestProduct = async (shopId) => {
  // Get products that sold in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentOrders = await Order.find({
    shop:      shopId,
    status:    "confirmed",
    createdAt: { $gte: sevenDaysAgo }
  }).lean();

  // Count sales per product
  const salesCount = {};
  recentOrders.forEach(order => {
    (order.items || []).forEach(item => {
      salesCount[item.name] = (salesCount[item.name] || 0) + item.qty;
    });
  });

  // Get all in-stock products
  const products = await Product.find({ owner: shopId, inStock: true }).lean();
  if (!products.length) return null;

  // Sort by recent sales, fallback to first product
  const sorted = products.sort((a, b) => (salesCount[b.name] || 0) - (salesCount[a.name] || 0));
  return sorted[0];
};

// ── Get shop performance summary ──────────────────────────────
const getShopSummary = async (shopId) => {
  const yesterday   = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo= new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);

  const [
    totalCustomers,
    hotBuyers,
    ordersYesterday,
    visitsYesterday,
    totalProducts,
  ] = await Promise.all([
    Customer.countDocuments({ owner: shopId }),
    Customer.countDocuments({ owner: shopId, buyerTag: "hot" }),
    Order.countDocuments({ shop: shopId, status:"confirmed", createdAt: { $gte: yesterday } }),
    CatalogVisit.countDocuments({ shop: shopId, createdAt: { $gte: yesterday } }),
    Product.countDocuments({ owner: shopId, inStock: true }),
  ]);

  return { totalCustomers, hotBuyers, ordersYesterday, visitsYesterday, totalProducts };
};

// ══════════════════════════════════════════════════════════════
// LAYER 1 — Morning AI Briefing
// Runs at 7am every day for every active shop
// ══════════════════════════════════════════════════════════════
const generateDailyBriefing = async (shopId) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Skip if already generated today
    const existing = await DailyBriefing.findOne({ shop: shopId, date: today });
    if (existing) return existing;

    const shop    = await User.findById(shopId);
    if (!shop) return null;

    // Need at least Anthropic key to run
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.warn("AI briefing skipped — no ANTHROPIC_API_KEY", { shopId });
      return null;
    }

    const product = await pickBestProduct(shopId);
    const summary = await getShopSummary(shopId);
    const catalogUrl = FRONTEND_URL + "/shop/" + shop.shopSlug;

    const prompt = `You are the AI marketing agent for a Nigerian small business on Kustomer.

SHOP: ${shop.name}
CATALOG: ${catalogUrl}
TODAY: ${new Date().toLocaleDateString("en-NG", { weekday:"long", day:"numeric", month:"long" })}

SHOP PERFORMANCE:
- Total customers: ${summary.totalCustomers}
- Hot buyers: ${summary.hotBuyers}
- Orders yesterday: ${summary.ordersYesterday}
- Catalog visits yesterday: ${summary.visitsYesterday}
- Products in stock: ${summary.totalProducts}

${product ? `TODAY'S FEATURED PRODUCT:
- Name: ${product.name}
- Price: ${product.currency}${product.price}
- Description: ${product.description || ""}` : "Promote the shop generally — no specific product"}

Write today's complete marketing content. Return ONLY valid JSON, no markdown:

{
  "reasoning": "1-2 sentences: why you chose this product and approach today",
  "waMessage": "WhatsApp broadcast message — 2-3 sentences, friendly Naija tone, ends with catalog link ${catalogUrl}",
  "waStatus": "WhatsApp Status — max 2 sentences, punchy, ends with 'Link in bio: ${catalogUrl}'",
  "facebook": "Facebook post — 3-4 sentences, conversational Nigerian English, ends with catalog link",
  "instagram": "Instagram caption — lifestyle tone, 2-3 sentences, ends with 4-5 Nigerian hashtags",
  "tiktok": "TikTok hook — under 120 chars, POV format, punchy Naija energy, 3 hashtags"
}`;

    const raw    = await callClaude(prompt, 1200);
    const clean  = raw.replace(/```json|```/g, "").trim();
    const data   = JSON.parse(clean);

    // Save briefing as draft
    const briefing = await DailyBriefing.create({
      shop:        shopId,
      date:        today,
      status:      "draft",
      product:     product?._id || null,
      productName: product?.name || "",
      waMessage:   data.waMessage  || "",
      waStatus:    data.waStatus   || "",
      facebook:    data.facebook   || "",
      instagram:   data.instagram  || "",
      tiktok:      data.tiktok     || "",
      aiReasoning: data.reasoning  || "",
    });

    // Deduct 5 credits for briefing generation
    await deductCredits(shopId, "ai_seo", 1); // 5 credits

    logger.info("Daily briefing generated", { shopId, date: today, product: product?.name });
    return briefing;

  } catch (e) {
    logger.error("Daily briefing failed", { shopId, error: e.message });
    return null;
  }
};

// ══════════════════════════════════════════════════════════════
// LAYER 2 — Evening Clicker Follow-Up
// Runs at 6pm — finds people who viewed but didn't buy
// ══════════════════════════════════════════════════════════════
const generateClickerFollowUps = async (shopId) => {
  try {
    const today      = new Date().toISOString().split("T")[0];
    const todayStart = new Date(today + "T00:00:00.000Z");
    const todayEnd   = new Date(today + "T23:59:59.999Z");

    const shop = await User.findById(shopId);
    if (!shop || !process.env.ANTHROPIC_API_KEY) return [];

    // Find customers who visited catalog today but have no order today
    const visits = await CatalogVisit.find({
      shop:      shopId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
      customer:  { $ne: null },
    }).populate("customer", "name phone buyerTag").lean();

    if (!visits.length) return [];

    // Get customers who ordered today — exclude them
    const orderedToday = await Order.distinct("customer", {
      shop:      shopId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });
    const orderedSet = new Set(orderedToday.map(id => id.toString()));

    // Unique clickers who did not order
    const clickers = {};
    visits.forEach(v => {
      if (!v.customer) return;
      const cid = v.customer._id.toString();
      if (orderedSet.has(cid)) return;
      if (!clickers[cid]) clickers[cid] = { customer: v.customer, products: [] };
      if (v.cartItems?.length) {
        v.cartItems.forEach(i => { if (!clickers[cid].products.includes(i.name)) clickers[cid].products.push(i.name); });
      }
    });

    const clickerList = Object.values(clickers);
    if (!clickerList.length) return [];

    // Generate personalised follow-up messages
    const catalogUrl = FRONTEND_URL + "/shop/" + shop.shopSlug;
    const followUps  = [];

    for (const { customer, products } of clickerList.slice(0, 50)) { // cap at 50 per day
      try {
        // Check not already sent today
        const alreadySent = await ClickerFollowUp.findOne({
          shop: shopId, customer: customer._id, date: today
        });
        if (alreadySent) continue;

        const productMention = products.length > 0
          ? `They looked at: ${products.slice(0,3).join(", ")}`
          : "They browsed your shop";

        const prompt = `Write a short friendly WhatsApp follow-up message for a Nigerian shop.

Shop: ${shop.name}
Customer first name: ${customer.name.split(" ")[0]}
${productMention}
Catalog link: ${catalogUrl}
Time: Evening

Write ONE short WhatsApp message (2 sentences max). Friendly, not pushy. Naija tone. Remind them gently, end with the link. No JSON, just the message text.`;

        const message = await callClaude(prompt, 150);

        const followUp = await ClickerFollowUp.create({
          shop:     shopId,
          customer: customer._id,
          date:     today,
          message:  message.trim(),
          products: products,
          sent:     false,
        });

        followUps.push(followUp);
      } catch (e) {
        logger.warn("Follow-up generation failed for customer", { customerId: customer._id });
      }
    }

    logger.info("Clicker follow-ups generated", { shopId, count: followUps.length });
    return followUps;

  } catch (e) {
    logger.error("Clicker follow-up failed", { shopId, error: e.message });
    return [];
  }
};

// ── Run briefings for ALL active shops ────────────────────────
const runMorningBriefings = async () => {
  logger.info("Running morning AI briefings for all shops");
  try {
    const shops = await User.find({ accountStatus: "active" }).select("_id").lean();
    let success = 0;
    for (const shop of shops) {
      const result = await generateDailyBriefing(shop._id);
      if (result) success++;
      // Small delay between shops to avoid API rate limits
      await new Promise(r => setTimeout(r, 500));
    }
    logger.info("Morning briefings complete", { total: shops.length, success });
  } catch (e) {
    logger.error("Morning briefings run failed", { error: e.message });
  }
};

// ── Run clicker follow-ups for ALL active shops ───────────────
const runEveningFollowUps = async () => {
  logger.info("Running evening clicker follow-ups for all shops");
  try {
    const shops = await User.find({ accountStatus: "active" }).select("_id").lean();
    let total = 0;
    for (const shop of shops) {
      const followUps = await generateClickerFollowUps(shop._id);
      total += followUps.length;
      await new Promise(r => setTimeout(r, 300));
    }
    logger.info("Evening follow-ups complete", { total });
  } catch (e) {
    logger.error("Evening follow-ups run failed", { error: e.message });
  }
};

module.exports = {
  generateDailyBriefing,
  generateClickerFollowUps,
  runMorningBriefings,
  runEveningFollowUps,
};
