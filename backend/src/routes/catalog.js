const express  = require("express");
const User     = require("../models/User");
const Product  = require("../models/Product");
const router   = express.Router();

router.get("/:shopSlug", async (req, res) => {
  try {
    const shop = await User.findOne({ shopSlug: req.params.shopSlug })
      .select("name shopDescription shopLogoUrl shopSlug phone");
    if (!shop) return res.status(404).json({ error: "Shop not found" });
    const products = await Product.find({ owner: shop._id, inStock: true })
      .sort({ sortOrder:1, createdAt:-1 })
      .select("name description price currency imageUrl inStock");
    res.json({ shop, products });
  } catch { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
