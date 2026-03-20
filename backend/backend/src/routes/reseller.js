const express  = require("express");
const { v4:uuidv4 } = require("uuid");
const User     = require("../models/User");
const ResellerSale = require("../models/ResellerSale");
const auth     = require("../middleware/auth");
const router   = express.Router();
router.use(auth);
router.get("/me", async (req, res) => {
  try {
    if (!req.user.isReseller) {
      const code = uuidv4().replace(/-/g,"").slice(0,8).toUpperCase();
      await User.findByIdAndUpdate(req.user._id, { isReseller:true, resellerCode:code });
    }
    const u = await User.findById(req.user._id);
    const sales = await ResellerSale.find({ reseller:u._id }).sort({ createdAt:-1 }).limit(20).lean();
    const totalShops = await User.countDocuments({ referredBy:u._id });
    const pending = await ResellerSale.aggregate([{ $match:{ reseller:u._id, paid:false } },{ $group:{ _id:null, total:{ $sum:"$commission" } } }]);
    res.json({ resellerCode:u.resellerCode, totalShops, totalEarnings:u.resellerEarnings||0, pendingPayout:pending[0]?.total||0, sales });
  } catch { res.status(500).json({ error:"Failed" }); }
});
router.post("/apply", async (req, res) => {
  try {
    if (req.user.isReseller) return res.json({ message:"Already a reseller", code:req.user.resellerCode });
    const code = uuidv4().replace(/-/g,"").slice(0,8).toUpperCase();
    const user = await User.findByIdAndUpdate(req.user._id, { isReseller:true, resellerCode:code }, { new:true });
    res.json({ message:"Reseller activated!", resellerCode:code, user });
  } catch { res.status(500).json({ error:"Failed" }); }
});
module.exports = router;
