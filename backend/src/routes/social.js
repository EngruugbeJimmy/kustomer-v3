/**
 * Social Media Management Routes
 * - Connect existing pages via OAuth
 * - Guide creation of new pages
 * - Post content automatically
 * - Boost posts with paid promotions
 */
const express        = require("express");
const axios          = require("axios");
const SocialPage     = require("../models/SocialPage");
const BoostCampaign  = require("../models/BoostCampaign");
const User           = require("../models/User");
const auth           = require("../middleware/auth");
const { logger }     = require("../middleware/logger");
const router         = express.Router();
router.use(auth);

const FB_APP_ID     = process.env.FACEBOOK_APP_ID;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const APP_URL       = process.env.APP_URL      || "http://localhost:5000";
const FRONTEND_URL  = process.env.FRONTEND_URL || "http://localhost:3000";

// ── GET /api/social/pages ─────────────────────────────────────
// Get all connected pages for this shop
router.get("/pages", async (req, res) => {
  try {
    const pages = await SocialPage.find({ shop: req.user._id }).lean();
    res.json({ pages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/social/connect/facebook ─────────────────────────
// Step 1: Get Facebook OAuth URL
router.get("/connect/facebook", (req, res) => {
  if (!FB_APP_ID) return res.status(500).json({ error: "Facebook App ID not configured" });
  const redirectUri = APP_URL + "/api/social/callback/facebook";
  const scopes = [
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_show_list",
    "instagram_basic",
    "instagram_content_publish",
    "ads_management",
    "business_management",
  ].join(",");
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${req.user._id}`;
  res.json({ url });
});

// ── GET /api/social/callback/facebook ────────────────────────
// Step 2: Facebook OAuth callback — exchange code for token
router.get("/callback/facebook", async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    if (!code || !userId) return res.redirect(FRONTEND_URL + "/social?error=oauth_failed");

    const redirectUri = APP_URL + "/api/social/callback/facebook";

    // Exchange code for short-lived token
    const tokenRes = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
      params: { client_id: FB_APP_ID, client_secret: FB_APP_SECRET, redirect_uri: redirectUri, code }
    });
    const shortToken = tokenRes.data.access_token;

    // Exchange for long-lived token (60 days)
    const longRes = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
      params: {
        grant_type:        "fb_exchange_token",
        client_id:         FB_APP_ID,
        client_secret:     FB_APP_SECRET,
        fb_exchange_token: shortToken,
      }
    });
    const longToken = longRes.data.access_token;
    const expiry    = new Date(Date.now() + (longRes.data.expires_in || 5184000) * 1000);

    // Get user's Facebook Pages
    const pagesRes = await axios.get("https://graph.facebook.com/v19.0/me/accounts", {
      params: { access_token: longToken, fields: "id,name,link,picture,fan_count" }
    });
    const pages = pagesRes.data.data || [];

    if (!pages.length) {
      return res.redirect(FRONTEND_URL + "/social?error=no_pages&setup=true");
    }

    // Save each page
    for (const page of pages) {
      await SocialPage.findOneAndUpdate(
        { shop: userId, platform: "facebook" },
        {
          pageId:       page.id,
          pageName:     page.name,
          pageUrl:      page.link || "",
          profileImage: page.picture?.data?.url || "",
          accessToken:  page.access_token || longToken,
          tokenExpiry:  expiry,
          status:       "connected",
          connectedAt:  new Date(),
          followers:    page.fan_count || 0,
        },
        { upsert: true, new: true }
      );

      // Also check for connected Instagram Business account
      try {
        const igRes = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
          params: {
            fields:       "instagram_business_account{id,name,username,followers_count,profile_picture_url}",
            access_token: page.access_token || longToken,
          }
        });
        const igAccount = igRes.data.instagram_business_account;
        if (igAccount) {
          await SocialPage.findOneAndUpdate(
            { shop: userId, platform: "instagram" },
            {
              pageId:       igAccount.id,
              pageName:     igAccount.name || igAccount.username,
              pageUrl:      `https://instagram.com/${igAccount.username}`,
              profileImage: igAccount.profile_picture_url || "",
              accessToken:  page.access_token || longToken,
              tokenExpiry:  expiry,
              status:       "connected",
              connectedAt:  new Date(),
              followers:    igAccount.followers_count || 0,
            },
            { upsert: true, new: true }
          );
        }
      } catch {}
    }

    logger.info("Facebook pages connected", { userId, pageCount: pages.length });
    res.redirect(FRONTEND_URL + "/social?connected=facebook");
  } catch (e) {
    logger.error("Facebook OAuth failed", { error: e.message });
    res.redirect(FRONTEND_URL + "/social?error=" + encodeURIComponent(e.message));
  }
});

// ── POST /api/social/post ─────────────────────────────────────
// Post content to connected pages
router.post("/post", async (req, res) => {
  try {
    const { platforms, message, imageUrl } = req.body;
    if (!platforms?.length || !message) return res.status(400).json({ error: "Platforms and message required" });

    const results = [];

    for (const platform of platforms) {
      const page = await SocialPage.findOne({ shop: req.user._id, platform, status: "connected" });
      if (!page) { results.push({ platform, success: false, error: "Not connected" }); continue; }

      try {
        if (platform === "facebook") {
          const params = { message, access_token: page.accessToken };
          if (imageUrl) params.url = imageUrl;
          const endpoint = imageUrl
            ? `https://graph.facebook.com/v19.0/${page.pageId}/photos`
            : `https://graph.facebook.com/v19.0/${page.pageId}/feed`;
          const postRes = await axios.post(endpoint, params);
          await SocialPage.findByIdAndUpdate(page._id, { $inc: { totalPosts: 1 } });
          results.push({ platform, success: true, postId: postRes.data.id });
        }

        if (platform === "instagram") {
          // Instagram requires two-step: create media container then publish
          const mediaRes = await axios.post(
            `https://graph.facebook.com/v19.0/${page.pageId}/media`,
            {
              caption:      message,
              image_url:    imageUrl || "",
              access_token: page.accessToken,
            }
          );
          const containerId = mediaRes.data.id;
          await axios.post(`https://graph.facebook.com/v19.0/${page.pageId}/media_publish`, {
            creation_id:  containerId,
            access_token: page.accessToken,
          });
          await SocialPage.findByIdAndUpdate(page._id, { $inc: { totalPosts: 1 } });
          results.push({ platform, success: true });
        }
      } catch (err) {
        results.push({ platform, success: false, error: err.response?.data?.error?.message || err.message });
      }
    }

    const allOk = results.every(r => r.success);
    res.json({ results, message: allOk ? "Posted to all platforms!" : "Some platforms failed — check results" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/social/boost ────────────────────────────────────
// Boost a post with paid promotion via Meta Ads API
router.post("/boost", async (req, res) => {
  try {
    const { postId, platform, budgetNaira, durationDays = 3, targetLocation = "Nigeria", targetAge } = req.body;
    if (!postId || !budgetNaira) return res.status(400).json({ error: "Post ID and budget required" });
    if (budgetNaira < 500) return res.status(400).json({ error: "Minimum boost budget is ₦500" });

    const page = await SocialPage.findOne({ shop: req.user._id, platform: platform || "facebook", status: "connected" });
    if (!page) return res.status(400).json({ error: "Connect your Facebook page first" });

    // Convert Naira to USD (approximate — use live rate in production)
    // Meta Ads requires USD minimum of $1/day
    const exchangeRate  = 1600; // ₦1,600 per $1 — update this periodically
    const budgetUsd     = Math.max(1, Math.round(budgetNaira / exchangeRate));
    const dailyBudget   = Math.round((budgetUsd / durationDays) * 100); // Meta uses cents

    // Get the user's Ad Account ID
    let adAccountId;
    try {
      const adAccRes = await axios.get("https://graph.facebook.com/v19.0/me/adaccounts", {
        params: { access_token: page.accessToken, fields: "id,name,account_status" }
      });
      const activeAccounts = adAccRes.data.data?.filter(a => a.account_status === 1);
      if (!activeAccounts?.length) {
        return res.status(400).json({
          error:    "No active Facebook Ad Account found",
          solution: "Create a Facebook Ad Account at facebook.com/adsmanager first",
          code:     "NO_AD_ACCOUNT"
        });
      }
      adAccountId = activeAccounts[0].id;
    } catch (e) {
      return res.status(400).json({ error: "Could not access Facebook Ad Account: " + e.message });
    }

    // Create boost campaign
    const campaignRes = await axios.post(
      `https://graph.facebook.com/v19.0/${adAccountId}/campaigns`,
      {
        name:       `Kustomer Boost — ${req.user.name} — ${new Date().toLocaleDateString()}`,
        objective:  "OUTCOME_TRAFFIC",
        status:     "ACTIVE",
        special_ad_categories: [],
        access_token: page.accessToken,
      }
    );
    const adCampaignId = campaignRes.data.id;

    // Create ad set with targeting
    const adSetRes = await axios.post(
      `https://graph.facebook.com/v19.0/${adAccountId}/adsets`,
      {
        name:           "Kustomer Boost Ad Set",
        campaign_id:    adCampaignId,
        daily_budget:   dailyBudget,
        billing_event:  "IMPRESSIONS",
        optimization_goal: "REACH",
        targeting: {
          geo_locations: {
            countries: ["NG"],
            cities: targetLocation !== "Nigeria" ? [{ key: targetLocation }] : undefined,
          },
          age_min: targetAge?.min || 18,
          age_max: targetAge?.max || 55,
        },
        start_time:   new Date().toISOString(),
        end_time:     new Date(Date.now() + durationDays * 86400000).toISOString(),
        status:       "ACTIVE",
        access_token: page.accessToken,
      }
    );
    const adSetId = adSetRes.data.id;

    // Create ad using existing post
    const adRes = await axios.post(
      `https://graph.facebook.com/v19.0/${adAccountId}/ads`,
      {
        name:       "Kustomer Boost Ad",
        adset_id:   adSetId,
        creative:   { object_story_id: postId },
        status:     "ACTIVE",
        access_token: page.accessToken,
      }
    );

    // Save boost record
    const boost = await BoostCampaign.create({
      shop:          req.user._id,
      socialPage:    page._id,
      platform:      platform || "facebook",
      postId,
      budgetNaira,
      durationDays,
      targetLocation,
      adCampaignId,
      adSetId,
      adId:          adRes.data.id,
      status:        "active",
      startedAt:     new Date(),
    });

    await SocialPage.findByIdAndUpdate(page._id, {
      $inc: { totalBoosts: 1, totalSpentOnBoosts: budgetNaira }
    });

    logger.info("Boost campaign created", { shopId: req.user._id, budgetNaira, adCampaignId });
    res.json({ boost, message: `Boost started! ₦${budgetNaira.toLocaleString()} over ${durationDays} days.` });
  } catch (e) {
    logger.error("Boost creation failed", { error: e.message });
    res.status(500).json({ error: "Boost failed: " + (e.response?.data?.error?.message || e.message) });
  }
});

// ── GET /api/social/boost/:id/results ────────────────────────
// Get boost campaign performance
router.get("/boost/:id/results", async (req, res) => {
  try {
    const boost = await BoostCampaign.findOne({ _id: req.params.id, shop: req.user._id });
    if (!boost) return res.status(404).json({ error: "Boost not found" });

    const page = await SocialPage.findById(boost.socialPage);
    if (!page) return res.status(404).json({ error: "Page not found" });

    // Fetch live insights from Meta
    try {
      const insightsRes = await axios.get(
        `https://graph.facebook.com/v19.0/${boost.adCampaignId}/insights`,
        { params: { fields: "reach,clicks,spend", access_token: page.accessToken } }
      );
      const insights = insightsRes.data.data?.[0] || {};
      await BoostCampaign.findByIdAndUpdate(boost._id, {
        reach:  parseInt(insights.reach  || 0),
        clicks: parseInt(insights.clicks || 0),
      });
      res.json({ boost: { ...boost.toObject(), reach: insights.reach, clicks: insights.clicks, spend: insights.spend } });
    } catch {
      res.json({ boost });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/social/boosts ────────────────────────────────────
router.get("/boosts", async (req, res) => {
  try {
    const boosts = await BoostCampaign.find({ shop: req.user._id })
      .sort({ createdAt: -1 }).limit(20).lean();
    res.json({ boosts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/social/disconnect/:platform ───────────────────
router.delete("/disconnect/:platform", async (req, res) => {
  try {
    await SocialPage.findOneAndUpdate(
      { shop: req.user._id, platform: req.params.platform },
      { status: "disconnected", accessToken: "" }
    );
    res.json({ message: req.params.platform + " disconnected" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
