/**
 * Kustomer Scheduler
 * Uses node-cron to run AI agent jobs automatically
 * All times in Africa/Lagos timezone (WAT = UTC+1)
 */
const cron   = require("node-cron");
const { logger } = require("../middleware/logger");
const {
  runMorningBriefings,
  runEveningFollowUps,
} = require("./aiAgent");

const startScheduler = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn("Scheduler: ANTHROPIC_API_KEY not set — AI jobs will be skipped");
    return;
  }

  logger.info("Kustomer AI Scheduler started");

  // ── 7:00 AM WAT — Generate daily briefings for all shops ────
  // Cron: minute hour * * * (0 6 = 6am UTC = 7am WAT)
  cron.schedule("0 6 * * *", async () => {
    logger.info("Scheduler: Running morning AI briefings");
    await runMorningBriefings();
  }, { timezone: "Africa/Lagos" });

  // ── 6:00 PM WAT — Generate clicker follow-ups ───────────────
  // 0 17 = 5pm UTC = 6pm WAT
  cron.schedule("0 17 * * *", async () => {
    logger.info("Scheduler: Running evening clicker follow-ups");
    await runEveningFollowUps();
  }, { timezone: "Africa/Lagos" });

  // ── Midnight WAT — Reset daily credits for all users ────────
  // This ensures everyone gets their free daily credits
  cron.schedule("0 23 * * *", async () => {
    logger.info("Scheduler: Resetting daily credits");
    try {
      const User = require("../models/User");
      // Reset dailyCredits to 0 — they get re-issued on next request via ensureDailyCredits
      await User.updateMany(
        { dailyCreditsDate: { $lt: new Date(new Date().toDateString()) } },
        { dailyCredits: 0 }
      );
    } catch (e) {
      logger.error("Daily credit reset failed", { error: e.message });
    }
  }, { timezone: "Africa/Lagos" });

  logger.info("Scheduler: 3 jobs registered", {
    jobs: [
      "7:00 AM WAT — Morning AI briefings",
      "6:00 PM WAT — Evening clicker follow-ups",
      "12:00 AM WAT — Daily credit reset",
    ]
  });
};

module.exports = { startScheduler };
