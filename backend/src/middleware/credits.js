/**
 * Kustomer Credits Middleware
 * Handles daily free allowance reset and credit deduction
 */
const User = require("../models/User");

// ── Credit costs per action ───────────────────────────────────
const COSTS = {
  wa_broadcast:    1,   // per customer
  sms:             3,   // per customer
  email:           1,   // per customer
  ai_seo:          5,   // per product
  social_post:     3,   // per caption
  youtube_script:  10,  // script generation
  youtube_render:  40,  // full render + publish
};

// ── Daily free allowance ──────────────────────────────────────
const DAILY_FREE = {
  wa_broadcast:  3,   // 3 broadcasts per day
  ai_seo:        1,   // 1 SEO generation per day
  social_post:   1,   // 1 social caption per day
};

// ── Total daily credits issued each day ──────────────────────
const DAILY_CREDIT_AMOUNT = 10; // enough for 3 WA + 1 SEO or 3 WA + 1 social

// ── Ensure user has their daily credits ──────────────────────
const ensureDailyCredits = async (user) => {
  const today = new Date().toDateString();
  const lastIssued = user.dailyCreditsDate
    ? new Date(user.dailyCreditsDate).toDateString()
    : null;

  if (lastIssued === today) return user; // already issued today

  // Issue daily credits — add to dailyCredits bucket
  const updated = await User.findByIdAndUpdate(
    user._id,
    {
      dailyCredits:     DAILY_CREDIT_AMOUNT,
      dailyCreditsDate: new Date(),
    },
    { new: true }
  );
  return updated;
};

// ── Check if user can afford an action ───────────────────────
const canAfford = (user, action, quantity = 1) => {
  const cost     = (COSTS[action] || 0) * quantity;
  const total    = (user.dailyCredits || 0) + (user.credits || 0);
  return { canAfford: total >= cost, cost, total, daily: user.dailyCredits || 0, purchased: user.credits || 0 };
};

// ── Deduct credits — daily first, then purchased ──────────────
const deductCredits = async (userId, action, quantity = 1) => {
  const cost = (COSTS[action] || 0) * quantity;
  if (cost === 0) return true;

  const user = await User.findById(userId);
  if (!user) return false;

  const total = (user.dailyCredits || 0) + (user.credits || 0);
  if (total < cost) return false;

  // Spend daily credits first
  let dailySpend     = Math.min(user.dailyCredits || 0, cost);
  let purchasedSpend = cost - dailySpend;

  await User.findByIdAndUpdate(userId, {
    $inc: {
      dailyCredits:      -dailySpend,
      credits:           -purchasedSpend,
      totalCreditsUsed:  cost,
    }
  });
  return true;
};

// ── Express middleware factory ────────────────────────────────
// Usage: router.post("/broadcast", requireCredits("wa_broadcast", req => req.body.count), ...)
const requireCredits = (action, getQuantity = () => 1) => async (req, res, next) => {
  try {
    // Refresh daily credits first
    req.user = await ensureDailyCredits(req.user);

    const quantity = getQuantity(req);
    const check    = canAfford(req.user, action, quantity);

    if (!check.canAfford) {
      return res.status(402).json({
        error:     "Not enough credits",
        code:      "INSUFFICIENT_CREDITS",
        required:  check.cost,
        available: check.total,
        daily:     check.daily,
        purchased: check.purchased,
        topUpUrl:  "/billing",
      });
    }

    // Attach deduct helper to request for use after action succeeds
    req.deductCredits = () => deductCredits(req.user._id, action, quantity);
    next();
  } catch (e) {
    res.status(500).json({ error: "Credit check failed" });
  }
};

module.exports = { COSTS, DAILY_FREE, ensureDailyCredits, canAfford, deductCredits, requireCredits };
