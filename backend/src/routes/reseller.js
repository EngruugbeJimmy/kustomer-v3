const express      = require("express");
const { v4: uuidv4 } = require("uuid");
const User         = require("../models/User");
const ResellerSale = require("../models/ResellerSale");
const Transaction  = require("../models/Transaction");
const auth         = require("../middleware/auth");
const router       = express.Router();
router.use(auth);

// GET /api/reseller/me — reseller dashboard data
router.get("/me", async (req, res) => {
  try {
    const user = req.user;
    // Auto-upgrade to reseller if first time
    if (!user.isReseller) {
      const code = uuidv4().replace(/-/g,"").slice(0,8).toUpperCase();
      await User.findByIdAndUpdate(user._id, { isReseller: true, resellerCode: code });
      user.isReseller   = true;
      user.resellerCode = code;
    }
    const sales = await ResellerSale.find({ reseller: user._id })
      .sort({ createdAt: -1 }).limit(20).lean();
    const totalShops      = await User.countDocuments({ referredBy: user._id });
    const totalEarnings   = user.resellerEarnings || 0;
    const pendingPayouts  = await ResellerSale.aggregate([
      { $match: { reseller: user._id, paid: false } },
      { $group: { _id: null, total: { $sum: "$commission" } } }
    ]);
    res.json({
      resellerCode:   user.resellerCode,
      totalShops,
      totalEarnings,
      pendingPayout:  pendingPayouts[0]?.total || 0,
      sales,
    });
  } catch (e) { res.status(500).json({ error: "Failed" }); }
});

// POST /api/reseller/apply — become a reseller
router.post("/apply", async (req, res) => {
  try {
    if (req.user.isReseller) return res.json({ message: "Already a reseller", code: req.user.resellerCode });
    const code = uuidv4().replace(/-/g,"").slice(0,8).toUpperCase();
    const user = await User.findByIdAndUpdate(req.user._id,
      { isReseller: true, resellerCode: code }, { new: true });
    res.json({ message: "Reseller account activated!", resellerCode: code, user });
  } catch { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
