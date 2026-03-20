const express = require("express");
const User    = require("../models/User");
const Product = require("../models/Product");
const SeoContent = require("../models/SeoContent");
const router  = express.Router();
router.get("/:shopSlug", async (req, res) => {
  try {
    const shop = await User.findOne({ shopSlug:req.params.shopSlug }).select("name shopDescription shopLogoUrl shopSlug phone");
    if (!shop) return res.status(404).json({ error:"Shop not found" });
    const products = await Product.find({ owner:shop._id, inStock:true }).sort({ sortOrder:1, createdAt:-1 });
    // Attach SEO data to each product
    const seoList = await SeoContent.find({ owner:shop._id }).lean();
    const seoMap = {};
    seoList.forEach(s => { seoMap[s.product.toString()] = s; });
    const enriched = products.map(p => ({ ...p.toObject(), seo: seoMap[p._id.toString()] || null }));
    res.json({ shop, products:enriched });
  } catch { res.status(500).json({ error:"Failed" }); }
});
module.exports = router;

// POST /api/catalog/order-ping — called client-side when order is placed
const express2 = require("express");
const User2 = require("../models/User");
module.exports.orderPing = async (shopSlug) => {
  if (shopSlug) await User2.findOneAndUpdate({ shopSlug }, { $inc:{ orderCount:1 } }).catch(()=>{});
};
