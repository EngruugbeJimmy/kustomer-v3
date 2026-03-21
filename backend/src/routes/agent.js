/**
 * AI Agent routes — briefing approval, follow-up management
 */
const express         = require("express");
const DailyBriefing   = require("../models/DailyBriefing");
const ClickerFollowUp = require("../models/ClickerFollowUp");
const Customer        = require("../models/Customer");
const User            = require("../models/User");
const auth            = require("../middleware/auth");
const { generateDailyBriefing, generateClickerFollowUps } = require("../services/aiAgent");
const { logger }      = require("../middleware/logger");
const router          = express.Router();
router.use(auth);

// ── GET /api/agent/today ──────────────────────────────────────
// Get today's briefing — generate if not yet created
router.get("/today", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    let briefing = await DailyBriefing.findOne({ shop: req.user._id, date: today })
      .populate("product", "name price currency imageUrl").lean();

    // Generate on demand if scheduler hasn't run yet
    if (!briefing) {
      briefing = await generateDailyBriefing(req.user._id);
    }

    // Get today's follow-ups
    const followUps = await ClickerFollowUp.find({ shop: req.user._id, date: today })
      .populate("customer", "name phone buyerTag").lean();

    // Recent briefing history
    const history = await DailyBriefing.find({ shop: req.user._id })
      .sort({ createdAt: -1 }).limit(7).lean();

    res.json({ briefing, followUps, history });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/agent/briefing/:id ─────────────────────────────
// Owner edits content before approving
router.patch("/briefing/:id", async (req, res) => {
  try {
    const { waMessage, waStatus, facebook, instagram, tiktok } = req.body;
    const briefing = await DailyBriefing.findOneAndUpdate(
      { _id: req.params.id, shop: req.user._id, status: "draft" },
      { waMessage, waStatus, facebook, instagram, tiktok, editedByOwner: true },
      { new: true }
    );
    if (!briefing) return res.status(404).json({ error: "Briefing not found or already approved" });
    res.json({ briefing });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agent/briefing/:id/approve ─────────────────────
// One-tap approval — marks as approved and ready to send
router.post("/briefing/:id/approve", async (req, res) => {
  try {
    const briefing = await DailyBriefing.findOneAndUpdate(
      { _id: req.params.id, shop: req.user._id, status: "draft" },
      { status: "approved", approvedAt: new Date() },
      { new: true }
    );
    if (!briefing) return res.status(404).json({ error: "Briefing not found or already approved" });

    logger.info("Briefing approved", { shopId: req.user._id, date: briefing.date });
    res.json({ briefing, message: "Approved! Content is ready to send." });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agent/briefing/:id/skip ────────────────────────
// Owner skips today's content
router.post("/briefing/:id/skip", async (req, res) => {
  try {
    const briefing = await DailyBriefing.findOneAndUpdate(
      { _id: req.params.id, shop: req.user._id },
      { status: "skipped", skippedAt: new Date() },
      { new: true }
    );
    res.json({ briefing, message: "Skipped for today." });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agent/briefing/:id/regenerate ──────────────────
// Regenerate today's content
router.post("/briefing/:id/regenerate", async (req, res) => {
  try {
    // Delete existing draft
    await DailyBriefing.findOneAndDelete({
      _id: req.params.id, shop: req.user._id, status: "draft"
    });
    // Generate fresh
    const briefing = await generateDailyBriefing(req.user._id);
    if (!briefing) return res.status(500).json({ error: "Generation failed — check Anthropic API key" });
    res.json({ briefing, message: "New content generated!" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/agent/follow-ups ─────────────────────────────────
// Get pending clicker follow-ups
router.get("/follow-ups", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const followUps = await ClickerFollowUp.find({
      shop: req.user._id, date: today, sent: false
    }).populate("customer", "name phone buyerTag").lean();
    res.json({ followUps });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agent/follow-ups/generate ──────────────────────
// Manually trigger evening follow-ups
router.post("/follow-ups/generate", async (req, res) => {
  try {
    const followUps = await generateClickerFollowUps(req.user._id);
    res.json({ followUps, count: followUps.length, message: followUps.length + " follow-ups ready" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agent/follow-up/:id/sent ───────────────────────
// Mark follow-up as sent after owner sends on WhatsApp
router.post("/follow-up/:id/sent", async (req, res) => {
  try {
    const fu = await ClickerFollowUp.findOneAndUpdate(
      { _id: req.params.id, shop: req.user._id },
      { sent: true, sentAt: new Date() },
      { new: true }
    );
    res.json({ followUp: fu });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/agent/stats ──────────────────────────────────────
// Agent performance stats
router.get("/stats", async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [briefings, followUps, converted] = await Promise.all([
      DailyBriefing.countDocuments({ shop: req.user._id, status: { $in: ["approved","sent"] }, createdAt: { $gte: sevenDaysAgo } }),
      ClickerFollowUp.countDocuments({ shop: req.user._id, sent: true, createdAt: { $gte: sevenDaysAgo } }),
      ClickerFollowUp.countDocuments({ shop: req.user._id, converted: true, createdAt: { $gte: sevenDaysAgo } }),
    ]);
    res.json({
      last7Days: {
        briefingsApproved: briefings,
        followUpsSent:     followUps,
        followUpsConverted:converted,
        conversionRate:    followUps > 0 ? Math.round((converted / followUps) * 100) : 0,
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
