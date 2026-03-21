/**
 * Kustomer AI Agent Service
 * Handles daily briefing generation and clicker follow-up automation
 * Runs on node-cron scheduler
 */

const axios    = require("axios");
const User     = require("../models/User");
const Product  = require("../models/Product");
const Customer = require("../models/Customer");
const Campaign = require("../models/Campaign");
const CatalogVisit = require("../models/CatalogVisit");
const Order    = require("../models/Order");
const DailyBriefing  = require("../models/DailyBriefing");
const ClickerFollowUp = require("../models/ClickerFollowUp");
const { deductCredits } = require("../middleware/credits");
const { logger } = require("../middleware/logger");

const APP_URL      = process.env.APP_URL      || "http://localhost:5000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// ── Helper: call Claude API ───────────────────────────────────
const callClaude = async (prompt, maxTokens = 1200) => {
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

// ── Helper: today's date string ───────────────────────────────
const today = () => new Date().toISOString().slice(0,10);

// ════════════════════════════════════════════════════════════
// LAYER 1 — DAILY BRIEFING GENERATION
// Runs at 7am every morning for every active shop
// ════════════════════════════════════════════════════════════

const generateDailyBriefing = async (shopId) => {
  try {
    const dateStr = today();
    const shop    = await User.findById(shopId);
    if (!shop) return;

    // Skip if already generated today
    const existing = await DailyBriefing.findOne({ shop:shopId, date:dateStr });
    if (existing) return;

    // Gather shop intelligence
    const [products, recentOrders, topVisits] = await Promise.all([
      Product.find({ owner:shopId, inStock:true }).sort({ createdAt:-1 }).limit(20).lean(),
      Order.find({ shop:shopId, status:"confirmed" })
        .sort({ createdAt:-1 }).limit(30).lean(),
      CatalogVisit.find({ shop:shopId, createdAt:{ $gte:new Date(Date.now()-7*24*60*60*1000) } })
        .populate("product").lean(),
    ]);

    if (!products.length) return; // no products, skip

    // Find best product to promote today
    // Score = recent orders + recent views
    const productScores = {};
    products.forEach(p => { productScores[p._id.toString()] = { product:p, orders:0, views:0 }; });
    recentOrders.forEach(o => {
      (o.items||[]).forEach(item => {
        if (productScores[item.productId]) productScores[item.productId].orders++;
      });
    });
    topVisits.forEach(v => {
      if (v.cartItems) {
        v.cartItems.forEach(item => {
          if (productScores[item.productId]) productScores[item.productId].views++;
        });
      }
    });

    const scored = Object.values(productScores)
      .map(s => ({ ...s, score: s.orders * 3 + s.views }))
      .sort((a,b) => b.score - a.score);

    // Pick top product — or random if no data yet
    const pick = scored[0]?.product || products[Math.floor(Math.random() * products.length)];
    const reasoning = scored[0]?.score > 0
      ? `${pick.name} has ${scored[0].orders} recent orders and ${scored[0].views} cart views this week`
      : `${pick.name} selected from your product catalog`;

    const catalogUrl = FRONTEND_URL + "/shop/" + shop.shopSlug;
    const customerCount = await Customer.countDocuments({ owner:shopId });

    // Generate all content with one Claude call
    const prompt = `You are an AI marketing agent for a Nigerian small business.

Shop: ${shop.name}
Today's featured product: ${pick.name} — ${pick.currency}${pick.price}
Product description: ${pick.description || "Quality product"}
Catalog link: ${catalogUrl}
Number of customers: ${customerCount}
Time: Morning in Lagos, Nigeria

Generate marketing content for today. Return ONLY valid JSON, no markdown:
{
  "waMessage": "WhatsApp broadcast message (2-3 lines max, ends with catalog link, warm Naija tone)",
  "waStatus": "WhatsApp Status text (1 line, punchy, ends with 'Link in bio' or shop link)",
  "facebook": "Facebook post (2-4 sentences, conversational, ends with catalog link)",
  "instagram": "Instagram caption (lifestyle tone, ends with 5 relevant Nigerian hashtags)",
  "tiktok": "TikTok caption (punchy hook under 150 chars, 4-5 trending Nigerian hashtags)",
  "reasoning": "One sentence explaining why you picked this product today"
}`;

    const raw  = await callClaude(prompt);
    const clean = raw.replace(/\`\`\`json|\`\`\`/g,"").trim();
    let content;
    try {
      content = JSON.parse(clean);
    } catch {
      content = {
        waMessage:  `Good morning! ${pick.name} is available now at ${shop.name}. Order here: ${catalogUrl}`,
        waStatus:   `${pick.name} available now! Check our catalog 👉 ${catalogUrl}`,
        facebook:   `Good morning Lagos! ${pick.name} is ready at ${shop.name}. Visit our catalog: ${catalogUrl}`,
        instagram:  `${pick.name} is here 🔥 Shop now at the link in bio! #NaijaFood #Lagos #SmallBusiness #NigeriaMarket #ShopLocal`,
        tiktok:     `POV: ${pick.name} just dropped 🔥 Link in bio to order! #Naija #Lagos #SmallBusiness #NaijaMarket`,
        reasoning:  reasoning,
      };
    }

    // Save briefing as draft
    await DailyBriefing.create({
      shop:         shopId,
      date:         dateStr,
      status:       "draft",
      product:      pick._id,
      productName:  pick.name,
      waMessage:    content.waMessage  || "",
      waStatus:     content.waStatus   || "",
      facebook:     content.facebook   || "",
      instagram:    content.instagram  || "",
      tiktok:       content.tiktok     || "",
      aiReasoning:  content.reasoning  || reasoning,
      generatedAt:  new Date(),
    });

    // Deduct 5 credits for generation
    await deductCredits(shopId, "ai_seo", 1);

    logger.info("Daily briefing generated", { shopId, product:pick.name });
  } catch (e) {
    logger.error("Briefing generation failed", { shopId, message:e.message });
  }
};

// Generate for ALL active shops
const generateAllBriefings = async () => {
  try {
    const shops = await User.find({ accountStatus:"active" }).select("_id").lean();
    logger.info("Generating daily briefings", { count:shops.length });
    // Stagger to avoid hammering Claude API
    for (const shop of shops) {
      await generateDailyBriefing(shop._id);
      await new Promise(r => setTimeout(r, 500)); // 500ms between each
    }
    logger.info("All briefings generated");
  } catch (e) {
    logger.error("generateAllBriefings failed", { message:e.message });
  }
};

// ════════════════════════════════════════════════════════════
// LAYER 2 — CLICKER FOLLOW-UP AUTOMATION
// Runs at 6pm every evening
// Finds people who clicked catalog today but didn't order
// ════════════════════════════════════════════════════════════

const generateClickerFollowUps = async (shopId) => {
  try {
    const dateStr = today();
    const shop    = await User.findById(shopId);
    if (!shop) return;

    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const endOfDay   = new Date(); endOfDay.setHours(23,59,59,999);

    // Find customers who visited catalog today but did NOT order
    const visitors = await CatalogVisit.find({
      shop:      shopId,
      createdAt: { $gte:startOfDay, $lte:endOfDay },
      customer:  { $ne:null },
      orderedAt: null,  // did not order
    }).populate("customer","name phone buyerTag totalOrders").lean();

    // Deduplicate by customer
    const seen = new Set();
    const uniqueVisitors = visitors.filter(v => {
      const id = v.customer?._id?.toString();
      if (!id || seen.has(id)) return false;
      seen.add(id); return true;
    });

    if (!uniqueVisitors.length) return;

    const catalogUrl = FRONTEND_URL + "/shop/" + shop.shopSlug;

    // Generate personalised follow-up messages
    for (const visit of uniqueVisitors.slice(0, 50)) { // max 50 per shop per day
      const customer = visit.customer;
      if (!customer) continue;

      // Skip if already sent today
      const alreadySent = await ClickerFollowUp.findOne({
        shop:shopId, customer:customer._id, date:dateStr
      });
      if (alreadySent) continue;

      const firstName = customer.name?.split(" ")[0] || "there";
      const isHotBuyer = customer.buyerTag === "hot" || customer.buyerTag === "buyer";

      // Generate personalised message
      const prompt = `Write a short WhatsApp follow-up message for a Nigerian shop customer.

Shop: ${shop.name}
Customer first name: ${firstName}
They visited the catalog today but did not order.
Is a repeat buyer: ${isHotBuyer ? "yes" : "no"}
Catalog link: ${catalogUrl}

Write 2-3 lines max. Warm, not pushy. Naija tone. Include the catalog link.
Return ONLY the message text, no quotes, no explanation.`;

      let message;
      try {
        message = await callClaude(prompt, 200);
        message = message.trim();
      } catch {
        message = `Hi ${firstName}! 👋 We noticed you checked out our catalog earlier. Still interested? We've got great items waiting for you: ${catalogUrl}`;
      }

      await ClickerFollowUp.create({
        shop:     shopId,
        customer: customer._id,
        date:     dateStr,
        message,
        sent:     false,
      });

      await new Promise(r => setTimeout(r, 300));
    }

    logger.info("Clicker follow-ups generated", { shopId, count:uniqueVisitors.length });
  } catch (e) {
    logger.error("Clicker follow-up generation failed", { shopId, message:e.message });
  }
};

const generateAllFollowUps = async () => {
  try {
    const shops = await User.find({ accountStatus:"active" }).select("_id").lean();
    for (const shop of shops) {
      await generateClickerFollowUps(shop._id);
      await new Promise(r => setTimeout(r, 300));
    }
    logger.info("All clicker follow-ups generated");
  } catch (e) {
    logger.error("generateAllFollowUps failed", { message:e.message });
  }
};

module.exports = {
  generateDailyBriefing,
  generateAllBriefings,
  generateAllFollowUps,
  generateClickerFollowUps,
};
