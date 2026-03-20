const express = require("express");
const User    = require("../models/User");
const Product = require("../models/Product");
const router  = express.Router();

const CATEGORIES = [
  "Food & Grocery","Fashion","Beauty & Health","Electronics",
  "Home & Living","Agriculture","Phones & Accessories",
  "Baby & Kids","Automotive","Services","General"
];

// ── GET /api/discover/categories ──────────────────────────────
router.get("/categories", (_, res) => res.json({ categories: CATEGORIES }));

// ── GET /api/discover/search?q=bread&category=Food&city=Lagos ─
router.get("/search", async (req, res) => {
  try {
    const { q, category, city, limit=20, skip=0 } = req.query;
    const shopQuery = { discoverable:{ $ne:false } };

    if (category && category !== "All") shopQuery.category = category;
    if (city?.trim()) shopQuery.city = { $regex:city.trim(), $options:"i" };
    if (q?.trim()) {
      shopQuery.$or = [
        { name:        { $regex:q.trim(), $options:"i" } },
        { shopSlug:    { $regex:q.trim(), $options:"i" } },
        { shopDescription: { $regex:q.trim(), $options:"i" } },
        { city:        { $regex:q.trim(), $options:"i" } },
        { category:    { $regex:q.trim(), $options:"i" } },
      ];
    }

    // Search shops
    const shops = await User.find(shopQuery)
      .select("name shopSlug shopDescription shopLogoUrl category city plan orderCount viewCount createdAt")
      .sort({ plan:-1, orderCount:-1, viewCount:-1, createdAt:-1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    // For each shop, attach product count + sample products
    const enriched = await Promise.all(shops.map(async shop => {
      const productQuery = { owner: shop._id, inStock: true };
      // If searching by product name, filter products too
      if (q?.trim()) {
        const matchingProducts = await Product.find({
          owner: shop._id, inStock: true,
          name: { $regex:q.trim(), $options:"i" }
        }).select("name price currency imageUrl").limit(3).lean();
        const allProducts = await Product.countDocuments({ owner:shop._id });
        return { ...shop, productCount:allProducts, sampleProducts:matchingProducts };
      }
      const [productCount, sampleProducts] = await Promise.all([
        Product.countDocuments(productQuery),
        Product.find(productQuery).select("name price currency imageUrl").limit(3).lean()
      ]);
      return { ...shop, productCount, sampleProducts };
    }));

    // Also search products directly if query given
    let productMatches = [];
    if (q?.trim()) {
      productMatches = await Product.find({
        name: { $regex:q.trim(), $options:"i" }, inStock:true
      })
      .populate("owner","name shopSlug category city")
      .select("name price currency imageUrl owner")
      .limit(10).lean();
    }

    // Increment view counts for returned shops
    if (shops.length > 0) {
      const shopIds = shops.map(s => s._id);
      User.updateMany({ _id:{ $in:shopIds } }, { $inc:{ viewCount:1 } }).catch(()=>{});
    }

    res.json({
      shops: enriched,
      products: productMatches,
      total: enriched.length,
      query: q || "",
    });
  } catch (e) { res.status(500).json({ error:"Search failed: " + e.message }); }
});

// ── GET /api/discover/trending ────────────────────────────────
router.get("/trending", async (req, res) => {
  try {
    const { limit=12 } = req.query;
    // Get top shops by order count
    const topShops = await User.find({ accountStatus:"active", phoneVerified:true, discoverStatus:"approved", discoverable:{ $ne:false } })
      .select("_id name shopSlug category city plan orderCount")
      .sort({ orderCount:-1, createdAt:-1 })
      .limit(20).lean();

    // Get 2-3 in-stock products from each top shop
    const trending = [];
    for (const shop of topShops.slice(0, parseInt(limit)/2)) {
      const prods = await Product.find({ owner:shop._id, inStock:true })
        .select("name price currency imageUrl").limit(2).lean();
      prods.forEach(p => trending.push({ ...p, shop: { name:shop.name, shopSlug:shop.shopSlug, category:shop.category } }));
      if (trending.length >= parseInt(limit)) break;
    }

    // Also get featured shops (paid plans first)
    const featured = await User.find({ accountStatus:"active", phoneVerified:true, discoverStatus:"approved", discoverable:{ $ne:false }, plan:{ $in:["starter","pro","reseller"] } })
      .select("name shopSlug shopDescription shopLogoUrl category city plan orderCount")
      .sort({ plan:-1, orderCount:-1 })
      .limit(6).lean();

    const featuredEnriched = await Promise.all(featured.map(async shop => {
      const productCount   = await Product.countDocuments({ owner:shop._id, inStock:true });
      const sampleProducts = await Product.find({ owner:shop._id, inStock:true })
        .select("name price currency imageUrl").limit(3).lean();
      return { ...shop, productCount, sampleProducts };
    }));

    res.json({ trending, featured: featuredEnriched });
  } catch (e) { res.status(500).json({ error: "Failed: " + e.message }); }
});

// ── GET /api/discover/category/:cat ───────────────────────────
router.get("/category/:cat", async (req, res) => {
  try {
    const { cat } = req.params;
    const { limit=20, skip=0 } = req.query;
    const shops = await User.find({ accountStatus:"active", phoneVerified:true, discoverStatus:"approved",
      category: { $regex:cat, $options:"i" },
      discoverable: { $ne:false }
    })
    .select("name shopSlug shopDescription shopLogoUrl category city plan orderCount viewCount")
    .sort({ plan:-1, orderCount:-1 })
    .limit(parseInt(limit)).skip(parseInt(skip)).lean();

    const enriched = await Promise.all(shops.map(async shop => {
      const [productCount, sampleProducts] = await Promise.all([
        Product.countDocuments({ owner:shop._id, inStock:true }),
        Product.find({ owner:shop._id, inStock:true }).select("name price currency imageUrl").limit(3).lean()
      ]);
      return { ...shop, productCount, sampleProducts };
    }));

    res.json({ shops:enriched, category:cat, total:enriched.length });
  } catch (e) { res.status(500).json({ error:"Failed" }); }
});

// ── POST /api/discover/order-ping ─────────────────────────────
// Called when a customer taps "order via WhatsApp" from catalog
// Increments shop order count for ranking
router.post("/order-ping", async (req, res) => {
  try {
    const { shopSlug } = req.body;
    if (shopSlug) await User.findOneAndUpdate({ shopSlug }, { $inc:{ orderCount:1 } });
    res.json({ ok:true });
  } catch { res.json({ ok:false }); }
});

module.exports = router;
