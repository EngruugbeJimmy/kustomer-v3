const express      = require("express");
const mongoose     = require("mongoose");
const Campaign     = require("../models/Campaign");
const CatalogVisit = require("../models/CatalogVisit");
const Customer     = require("../models/Customer");
const Order        = require("../models/Order");
const User         = require("../models/User");
const auth         = require("../middleware/auth");
const router       = express.Router();
router.use(auth);

// ── GET /api/analytics/dashboard ─────────────────────────────
// Overall shop stats
router.get("/dashboard", async (req, res) => {
  try {
    const shopId = req.user._id;
    const [
      totalCustomers, hotBuyers, buyers, clickers, ghosts,
      totalOrders, totalRevenue, recentOrders, topProducts
    ] = await Promise.all([
      Customer.countDocuments({ owner: shopId }),
      Customer.countDocuments({ owner: shopId, buyerTag: "hot" }),
      Customer.countDocuments({ owner: shopId, buyerTag: "buyer" }),
      Customer.countDocuments({ owner: shopId, buyerTag: "clicker" }),
      Customer.countDocuments({ owner: shopId, buyerTag: "ghost" }),
      Order.countDocuments({ shop: shopId, status: "confirmed" }),
      Order.aggregate([
        { $match: { shop: shopId, status: "confirmed" } },
        { $group: { _id: null, total: { $sum: "$total" } } }
      ]),
      Order.find({ shop: shopId }).sort({ createdAt: -1 }).limit(5)
        .populate("customer", "name phone buyerTag").lean(),
      Order.aggregate([
        { $match: { shop: shopId, status: "confirmed" } },
        { $unwind: "$items" },
        { $group: { _id: "$items.name", count: { $sum: "$items.qty" }, revenue: { $sum: { $multiply: ["$items.price","$items.qty"] } } } },
        { $sort: { count: -1 } }, { $limit: 5 }
      ])
    ]);
    res.json({
      customers: { total: totalCustomers, hot: hotBuyers, buyers, clickers, ghosts },
      orders:    { total: totalOrders, revenue: totalRevenue[0]?.total || 0 },
      recentOrders,
      topProducts,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/analytics/campaign/:id ──────────────────────────
// Funnel for a specific broadcast
router.get("/campaign/:id", async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, owner: req.user._id });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const [visits, carts, waOrders, confirmed] = await Promise.all([
      CatalogVisit.countDocuments({ campaign: campaign._id }),
      CatalogVisit.countDocuments({ campaign: campaign._id, addedToCart: true }),
      CatalogVisit.countDocuments({ campaign: campaign._id, orderedAt: { $ne: null } }),
      Order.countDocuments({ campaign: campaign._id, status: "confirmed" }),
    ]);

    const sent = campaign.recipientCount || 0;
    res.json({
      campaign,
      funnel: {
        sent,
        opened:    visits,
        addedCart: carts,
        ordered:   waOrders,
        confirmed,
        openRate:    sent   > 0 ? Math.round((visits    / sent)    * 100) : 0,
        cartRate:    sent   > 0 ? Math.round((carts     / sent)    * 100) : 0,
        orderRate:   sent   > 0 ? Math.round((waOrders  / sent)    * 100) : 0,
        confirmRate: sent   > 0 ? Math.round((confirmed / sent)    * 100) : 0,
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/analytics/campaigns ─────────────────────────────
// All campaigns with funnel data
router.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await Campaign.find({ owner: req.user._id, channel: "whatsapp" })
      .sort({ createdAt: -1 }).limit(10).lean();

    const enriched = await Promise.all(campaigns.map(async (c) => {
      const [visits, confirmed] = await Promise.all([
        CatalogVisit.countDocuments({ campaign: c._id }),
        Order.countDocuments({ campaign: c._id, status: "confirmed" }),
      ]);
      const sent = c.recipientCount || 0;
      return {
        ...c,
        openRate:  sent > 0 ? Math.round((visits    / sent) * 100) : 0,
        orderRate: sent > 0 ? Math.round((confirmed / sent) * 100) : 0,
        visits, confirmed,
      };
    }));
    res.json({ campaigns: enriched });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/analytics/customers ─────────────────────────────
// Smart customer list with buyer tags
router.get("/customers", async (req, res) => {
  try {
    const { tag, sort = "totalOrders", search } = req.query;
    const q = { owner: req.user._id };
    if (tag && tag !== "all") q.buyerTag = tag;
    if (search?.trim()) q.$or = [
      { name:  { $regex: search.trim(), $options: "i" } },
      { phone: { $regex: search.trim(), $options: "i" } },
    ];
    const sortMap = {
      totalOrders: { totalOrders: -1 },
      totalSpent:  { totalSpent: -1 },
      lastSeen:    { lastSeenAt: -1 },
      recent:      { createdAt: -1 },
    };
    const customers = await Customer.find(q)
      .sort(sortMap[sort] || { totalOrders: -1 })
      .limit(100).lean();
    res.json({ customers, total: customers.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/analytics/customer/:id ──────────────────────────
// Full customer profile with history
router.get("/customer/:id", async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, owner: req.user._id });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const orders = await Order.find({ customer: customer._id, shop: req.user._id })
      .sort({ createdAt: -1 }).limit(20).lean();
    const visits = await CatalogVisit.find({ customer: customer._id, shop: req.user._id })
      .sort({ createdAt: -1 }).limit(10).lean();
    res.json({ customer, orders, visits });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/analytics/track-visit ──────────────────────────
// Called when customer opens catalog link (no auth — public)
router.post("/track-visit", async (req, res) => {
  try {
    const { shopSlug, trackingId, campaignId, source } = req.body;
    const shop = await User.findOne({ shopSlug });
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    // Find customer by trackingId (encoded phone hash)
    let customer = null;
    if (trackingId) {
      customer = await Customer.findOne({ owner: shop._id, _id: trackingId }).catch(() => null);
    }

    const visit = await CatalogVisit.create({
      shop:       shop._id,
      customer:   customer?._id || null,
      campaign:   campaignId || null,
      trackingId: trackingId || "",
      source:     source || "unknown",
      ip:         req.ip,
    });

    // Update customer last seen + open count
    if (customer) {
      const tag = customer.computeTag();
      await Customer.findByIdAndUpdate(customer._id, {
        lastSeenAt:    new Date(),
        buyerTag:      tag,
        $inc:          { catalogVisits: 1, broadcastsOpened: campaignId ? 1 : 0 }
      });
    }

    res.json({ visitId: visit._id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/analytics/track-cart ───────────────────────────
// Called when customer adds to cart
router.post("/track-cart", async (req, res) => {
  try {
    const { visitId, items } = req.body;
    if (!visitId) return res.json({ ok: true });
    await CatalogVisit.findByIdAndUpdate(visitId, {
      addedToCart: true,
      cartItems:   items || [],
    });

    // Update customer abandon count if not yet ordered
    const visit = await CatalogVisit.findById(visitId);
    if (visit?.customer) {
      await Customer.findByIdAndUpdate(visit.customer, {
        $inc: { cartAbandons: 1 }
      });
    }
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

// ── POST /api/analytics/track-order ──────────────────────────
// Called when customer initiates WhatsApp order (before app opens)
router.post("/track-order", async (req, res) => {
  try {
    const { visitId, shopSlug, items, orderType, customerName, customerPhone } = req.body;

    const shop = await User.findOne({ shopSlug });
    if (!shop) return res.json({ ok: true });

    // Update visit
    if (visitId) {
      await CatalogVisit.findByIdAndUpdate(visitId, { orderedAt: new Date() });
    }

    // Find or create customer
    let customer = null;
    if (customerPhone) {
      const cleanPhone = customerPhone.replace(/[\s\-()]/g, "");
      customer = await Customer.findOneAndUpdate(
        { owner: shop._id, phone: cleanPhone },
        { $setOnInsert: { name: customerName || cleanPhone, owner: shop._id, phone: cleanPhone } },
        { upsert: true, new: true }
      );
    } else if (visitId) {
      const visit = await CatalogVisit.findById(visitId);
      if (visit?.customer) customer = await Customer.findById(visit.customer);
    }

    // Create pending order
    const total = (items || []).reduce((s, i) => s + (i.price * i.qty), 0);
    const order = await Order.create({
      shop:      shop._id,
      customer:  customer?._id,
      campaign:  null,
      items:     items || [],
      total,
      currency:  items?.[0]?.currency || "₦",
      orderType: orderType || "pickup",
      status:    "pending",
      source:    "catalog",
    });

    res.json({ orderId: order._id, ok: true });
  } catch { res.json({ ok: true }); }
});

// ── GET /api/analytics/pending-orders ────────────────────────
// Orders waiting for shop owner to confirm
router.get("/pending-orders", async (req, res) => {
  try {
    const orders = await Order.find({ shop: req.user._id, status: "pending" })
      .sort({ createdAt: -1 }).limit(50)
      .populate("customer", "name phone buyerTag totalOrders").lean();
    res.json({ orders });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/analytics/confirm-order ────────────────────────
// Shop owner marks order as sold
router.post("/confirm-order", auth, async (req, res) => {
  try {
    const { orderId, action } = req.body; // action: "confirmed" | "cancelled"

    const order = await Order.findOne({ _id: orderId, shop: req.user._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status      = action === "confirmed" ? "confirmed" : "cancelled";
    order.confirmedAt = action === "confirmed" ? new Date() : null;
    await order.save();

    if (action === "confirmed" && order.customer) {
      // Update customer stats and recompute tag
      const customer = await Customer.findById(order.customer);
      if (customer) {
        customer.totalOrders  = (customer.totalOrders  || 0) + 1;
        customer.totalSpent   = (customer.totalSpent   || 0) + order.total;
        customer.lastOrderAt  = new Date();
        customer.buyerTag     = customer.computeTag();
        // Track favorite products
        const productNames = order.items.map(i => i.name);
        customer.favoriteProducts = [...new Set([...customer.favoriteProducts, ...productNames])].slice(0, 10);
        await customer.save();
      }
    }


    // If order came from an agent link, record their commission
    if (order.agentCode && action === "confirmed") {
      try {
        const axios = require("axios");
        const APP_URL = process.env.APP_URL || "http://localhost:5000";
        await axios.post(APP_URL + "/api/agents/record-sale", {
          orderId: order._id.toString(),
          agentCode: order.agentCode,
          shopId: order.shop.toString(),
        }, { headers:{ Authorization: req.headers.authorization } });
      } catch {}
    }
    res.json({ order, message: action === "confirmed" ? "Sale confirmed! 💰" : "Order cancelled" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/analytics/broadcast-delivered ──────────────────
// Called after broadcast to update customer stats
router.post("/broadcast-delivered", auth, async (req, res) => {
  try {
    const { customerIds } = req.body;
    if (!customerIds?.length) return res.json({ ok: true });
    await Customer.updateMany(
      { _id: { $in: customerIds }, owner: req.user._id },
      { $inc: { broadcastsReceived: 1 } }
    );
    // Recompute ghost tags for new customers who haven't opened
    await Customer.updateMany(
      { _id: { $in: customerIds }, owner: req.user._id, catalogVisits: 0, totalOrders: 0 },
      { buyerTag: "ghost" }
    );
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

module.exports = router;
