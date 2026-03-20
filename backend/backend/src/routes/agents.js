const express   = require("express");
const { v4:uuidv4 } = require("uuid");
const User      = require("../models/User");
const AgentShop = require("../models/AgentShop");
const AgentSale = require("../models/AgentSale");
const Order     = require("../models/Order");
const auth      = require("../middleware/auth");
const router    = express.Router();

const APP_URL = process.env.APP_URL || "http://localhost:5000";

// ── Helper: generate short agent code ─────────────────────────
const makeAgentCode = (name) => {
  const base = name.replace(/[^a-zA-Z]/g,"").toUpperCase().slice(0,5);
  const suffix = Math.random().toString(36).slice(2,5).toUpperCase();
  return base + suffix;
};

// ── Helper: generate invite code ──────────────────────────────
const makeInviteCode = () => uuidv4().replace(/-/g,"").slice(0,10).toUpperCase();

// ═══════════════════════════════════════════════════════════════
// AGENT ROUTES — for people who sell on behalf of shops
// ═══════════════════════════════════════════════════════════════

// POST /api/agents/become-agent — any user activates agent account
router.post("/become-agent", auth, async (req, res) => {
  try {
    const { bio } = req.body;
    if (req.user.isAgent) return res.json({ message:"Already an agent", agentCode: req.user.agentCode });
    const agentCode = makeAgentCode(req.user.name);
    const user = await User.findByIdAndUpdate(req.user._id, {
      isAgent:   true,
      agentCode: agentCode,
      agentBio:  bio || "",
    }, { new:true });
    res.json({ message:"Agent account activated!", agentCode, user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/agents/my-dashboard — agent sees all shops + earnings
router.get("/my-dashboard", auth, async (req, res) => {
  try {
    if (!req.user.isAgent) return res.status(400).json({ error:"Not an agent. Activate agent account first." });

    const shopLinks = await AgentShop.find({ agent: req.user._id, status:"active" })
      .populate("shop", "name shopSlug shopDescription shopLogoUrl phone").lean();

    // Earnings summary per shop
    const enriched = await Promise.all(shopLinks.map(async (link) => {
      const sales = await AgentSale.find({ agent: req.user._id, shop: link.shop._id })
        .sort({ createdAt:-1 }).limit(5).lean();
      const unpaid = await AgentSale.aggregate([
        { $match: { agent: req.user._id, shop: link.shop._id, paid:false } },
        { $group: { _id:null, total:{ $sum:"$commissionAmt" } } }
      ]);
      return { ...link, recentSales: sales, unpaidEarnings: unpaid[0]?.total || 0 };
    }));

    // Pending shop invites
    const pendingInvites = await AgentShop.find({ agent: req.user._id, status:"pending" })
      .populate("shop","name shopSlug").lean();

    res.json({
      agentCode:    req.user.agentCode,
      totalEarned:  req.user.agentTotalEarned || 0,
      totalPaid:    req.user.agentTotalPaid   || 0,
      unpaidTotal:  (req.user.agentTotalEarned || 0) - (req.user.agentTotalPaid || 0),
      shops:        enriched,
      pendingInvites,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/agents/my-sales — all sales across all shops
router.get("/my-sales", auth, async (req, res) => {
  try {
    const { paid } = req.query;
    const q = { agent: req.user._id };
    if (paid === "true")  q.paid = true;
    if (paid === "false") q.paid = false;
    const sales = await AgentSale.find(q)
      .sort({ createdAt:-1 }).limit(50)
      .populate("shop","name shopSlug").lean();
    res.json({ sales });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/agents/join-shop — agent joins via invite code (public — no auth needed for link)
router.post("/join-shop", async (req, res) => {
  try {
    const { inviteCode, agentId } = req.body;
    if (!inviteCode || !agentId) return res.status(400).json({ error:"Invite code and agent ID required" });

    const link = await AgentShop.findOne({ inviteCode })
      .populate("shop","name shopSlug commissionPct agentsEnabled");
    if (!link) return res.status(404).json({ error:"Invite code not found or expired" });
    if (!link.shop.agentsEnabled) return res.status(400).json({ error:"This shop is not accepting agents" });

    // Check if already linked
    const existing = await AgentShop.findOne({ agent:agentId, shop:link.shop._id });
    if (existing) return res.json({ message:"Already linked to this shop", link:existing });

    // Create the agent-shop link
    const newLink = await AgentShop.create({
      agent:         agentId,
      shop:          link.shop._id,
      shopName:      link.shop.name,
      shopSlug:      link.shop.shopSlug,
      commissionPct: link.shop.defaultCommission || 10,
      status:        "active",
      joinedAt:      new Date(),
    });

    // Activate agent account if not already
    await User.findByIdAndUpdate(agentId, { isAgent:true, $setOnInsert:{ agentCode: makeAgentCode("AGENT") } }, { upsert:false });

    res.json({ message:"Joined " + link.shop.name + " as agent!", link:newLink });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/agents/catalog-link/:shopSlug — get agent's tracked link for a shop
router.get("/catalog-link/:shopSlug", auth, async (req, res) => {
  try {
    const shop = await User.findOne({ shopSlug: req.params.shopSlug });
    if (!shop) return res.status(404).json({ error:"Shop not found" });

    const link = await AgentShop.findOne({ agent: req.user._id, shop: shop._id, status:"active" });
    if (!link) return res.status(403).json({ error:"You are not an agent for this shop" });

    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    const trackedUrl   = FRONTEND_URL + "/shop/" + shop.shopSlug + "?agent=" + req.user.agentCode;

    res.json({ trackedUrl, agentCode: req.user.agentCode, commissionPct: link.commissionPct });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// SHOP OWNER ROUTES — manage their agents
// ═══════════════════════════════════════════════════════════════

// GET /api/agents/shop-dashboard — shop owner sees all their agents
router.get("/shop-dashboard", auth, async (req, res) => {
  try {
    const agents = await AgentShop.find({ shop: req.user._id, status:"active" })
      .populate("agent","name phone agentCode agentTotalEarned").lean();

    const enriched = await Promise.all(agents.map(async (a) => {
      const [totalSales, unpaid] = await Promise.all([
        AgentSale.countDocuments({ agentShop: a._id }),
        AgentSale.aggregate([
          { $match: { agentShop: a._id, paid:false } },
          { $group: { _id:null, total:{ $sum:"$commissionAmt" } } }
        ]),
      ]);
      return { ...a, totalSales, unpaidEarnings: unpaid[0]?.total || 0 };
    }));

    const pending = await AgentShop.find({ shop: req.user._id, status:"pending" })
      .populate("agent","name phone").lean();

    res.json({
      agents:      enriched,
      pending,
      commissionPct: req.user.defaultCommission || 10,
      agentsEnabled: req.user.agentsEnabled || false,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/agents/shop-settings — enable agents, set commission %
router.post("/shop-settings", auth, async (req, res) => {
  try {
    const { agentsEnabled, defaultCommission } = req.body;
    const update = {};
    if (agentsEnabled !== undefined) update.agentsEnabled = agentsEnabled;
    if (defaultCommission)           update.defaultCommission = Math.min(50, Math.max(1, parseInt(defaultCommission)));
    const user = await User.findByIdAndUpdate(req.user._id, update, { new:true });
    res.json({ message:"Settings saved", user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/agents/generate-invite — shop owner generates an invite link
router.post("/generate-invite", auth, async (req, res) => {
  try {
    if (!req.user.agentsEnabled) return res.status(400).json({ error:"Enable agents in settings first" });
    const code    = makeInviteCode();
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    const inviteUrl = FRONTEND_URL + "/join-agent?code=" + code + "&shop=" + req.user.shopSlug;

    // Store invite code on a placeholder AgentShop (agent field null until someone joins)
    await AgentShop.create({
      agent:         req.user._id, // temporary — replaced when agent joins
      shop:          req.user._id,
      shopName:      req.user.name,
      shopSlug:      req.user.shopSlug,
      commissionPct: req.user.defaultCommission || 10,
      status:        "pending",
      inviteCode:    code,
    });

    res.json({ inviteCode: code, inviteUrl, commissionPct: req.user.defaultCommission || 10 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/agents/update-commission/:agentShopId — change % for specific agent
router.post("/update-commission/:agentShopId", auth, async (req, res) => {
  try {
    const { commissionPct } = req.body;
    const link = await AgentShop.findOne({ _id: req.params.agentShopId, shop: req.user._id });
    if (!link) return res.status(404).json({ error:"Agent not found" });
    link.commissionPct = Math.min(50, Math.max(1, parseInt(commissionPct)));
    await link.save();
    res.json({ message:"Commission updated", link });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/agents/remove/:agentShopId — remove agent from shop
router.post("/remove/:agentShopId", auth, async (req, res) => {
  try {
    await AgentShop.findOneAndUpdate(
      { _id: req.params.agentShopId, shop: req.user._id },
      { status:"removed" }
    );
    res.json({ message:"Agent removed" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/agents/sales-report — commission statement for a specific agent
router.get("/sales-report/:agentShopId", auth, async (req, res) => {
  try {
    const link = await AgentShop.findOne({ _id: req.params.agentShopId, shop: req.user._id })
      .populate("agent","name phone agentCode");
    if (!link) return res.status(404).json({ error:"Not found" });

    const sales = await AgentSale.find({ agentShop: link._id })
      .sort({ createdAt:-1 }).lean();

    const unpaidTotal = sales.filter(s => !s.paid).reduce((sum,s) => sum + s.commissionAmt, 0);
    const paidTotal   = sales.filter(s =>  s.paid).reduce((sum,s) => sum + s.commissionAmt, 0);

    res.json({ link, sales, unpaidTotal, paidTotal });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/agents/mark-paid/:agentShopId — shop owner marks commission as paid
router.post("/mark-paid/:agentShopId", auth, async (req, res) => {
  try {
    const { saleIds, note } = req.body; // saleIds = array of AgentSale IDs to mark paid
    const link = await AgentShop.findOne({ _id: req.params.agentShopId, shop: req.user._id });
    if (!link) return res.status(404).json({ error:"Not found" });

    const result = await AgentSale.updateMany(
      { _id: { $in: saleIds }, agentShop: link._id, paid:false },
      { paid:true, paidAt:new Date(), note: note||"" }
    );

    // Sum what was just paid
    const justPaid = await AgentSale.aggregate([
      { $match: { _id: { $in: saleIds.map(id => require("mongoose").Types.ObjectId(id)) }, paid:true } },
      { $group: { _id:null, total:{ $sum:"$commissionAmt" } } }
    ]);
    const paidAmount = justPaid[0]?.total || 0;

    // Update agent total paid
    await User.findByIdAndUpdate(link.agent, { $inc:{ agentTotalPaid: paidAmount } });
    await AgentShop.findByIdAndUpdate(link._id, { $inc:{ totalPaid: paidAmount } });

    res.json({ message:"Commission marked as paid!", paidAmount, modified: result.modifiedCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// SHARED — track a sale from agent link (called from analytics route on order confirm)
// ═══════════════════════════════════════════════════════════════

// POST /api/agents/record-sale — internal, called when order confirmed
router.post("/record-sale", auth, async (req, res) => {
  try {
    const { orderId, agentCode, shopId } = req.body;

    const agent = await User.findOne({ agentCode });
    if (!agent) return res.json({ ok:true, message:"No agent" });


    // Self-referral guard — agent cannot earn from their own orders
    if (agent._id.toString() === shopId.toString()) {
      return res.json({ ok:true, message:"Self-referral detected — no commission" });
    }
    // Also check if the order customer phone matches agent phone
    if (order.customer) {
      const Customer = require("../models/Customer");
      const cust = await Customer.findById(order.customer).select("phone");
      if (cust && agent.phone && cust.phone === agent.phone) {
        return res.json({ ok:true, message:"Agent is the customer — no commission" });
      }
    }

    const link = await AgentShop.findOne({ agent: agent._id, shop: shopId, status:"active" });
    if (!link) return res.json({ ok:true, message:"Agent not linked to this shop" });

    const order = await Order.findById(orderId);
    if (!order || order.status !== "confirmed") return res.json({ ok:true });

    const commissionAmt = Math.round(order.total * (link.commissionPct / 100));
    const shopAmount    = order.total - commissionAmt;

    await AgentSale.create({
      agent:         agent._id,
      shop:          shopId,
      agentShop:     link._id,
      order:         orderId,
      saleAmount:    order.total,
      commissionPct: link.commissionPct,
      commissionAmt,
      shopAmount,
      currency:      order.currency || "₦",
    });

    // Update totals
    await AgentShop.findByIdAndUpdate(link._id, {
      $inc: { totalSales:1, totalEarned: commissionAmt }
    });
    await User.findByIdAndUpdate(agent._id, {
      $inc: { agentTotalEarned: commissionAmt }
    });

    res.json({ ok:true, commissionAmt, shopAmount, agentCode });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/agents/discover — public list of shops accepting agents
router.get("/discover", async (req, res) => {
  try {
    const shops = await User.find({ agentsEnabled:true })
      .select("name shopSlug shopDescription defaultCommission shopLogoUrl")
      .sort({ createdAt:-1 }).limit(20).lean();
    res.json({ shops });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
