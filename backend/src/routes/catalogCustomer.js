const express  = require("express");
const Customer = require("../models/Customer");
const User     = require("../models/User");
const router   = express.Router();

// POST /api/catalog/:shopSlug/customer
// Called from the public catalog page — no auth needed
// Saves the ordering customer to the shop owner's customer list
router.post("/:shopSlug/customer", async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name?.trim() || !phone?.trim())
      return res.status(400).json({ error:"Name and phone required" });

    const shop = await User.findOne({ shopSlug: req.params.shopSlug });
    if (!shop) return res.status(404).json({ error:"Shop not found" });

    // Check plan customer limit
    const plan    = User.PLANS[shop.plan] || User.PLANS.free;
    const current = await Customer.countDocuments({ owner: shop._id });
    if (plan.customerLimit > 0 && current >= plan.customerLimit) {
      // Silently succeed — don't block the order because of a plan limit
      return res.json({ saved:false, message:"Customer limit reached" });
    }

    // Upsert — if phone already exists for this shop, just update name
    const customer = await Customer.findOneAndUpdate(
      { owner: shop._id, phone: phone.trim().replace(/[\s\-()]/g,"") },
      { name: name.trim(), phone: phone.trim().replace(/[\s\-()]/g,""), owner: shop._id },
      { upsert:true, new:true, setDefaultsOnInsert:true }
    );

    res.json({ saved:true, customer: { name:customer.name, phone:customer.phone } });
  } catch (e) {
    // Never block the order — just return ok
    res.json({ saved:false });
  }
});

module.exports = router;
