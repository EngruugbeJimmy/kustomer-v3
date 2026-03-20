const express    = require("express");
const axios      = require("axios");
const slugify    = require("slugify");
const Product    = require("../models/Product");
const SeoContent = require("../models/SeoContent");
const auth       = require("../middleware/auth");
const router     = express.Router();
router.use(auth);

// GET /api/ai-seo/:productId — get existing SEO for a product
router.get("/:productId", async (req, res) => {
  try {
    const seo = await SeoContent.findOne({ product: req.params.productId, owner: req.user._id });
    res.json({ seo: seo || null });
  } catch { res.status(500).json({ error:"Failed" }); }
});

// POST /api/ai-seo/generate — AI generates SEO content for a product
router.post("/generate", async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findOne({ _id:productId, owner:req.user._id });
    if (!product) return res.status(404).json({ error:"Product not found" });

    // Check plan allows AI SEO
    if (req.user.plan === "free")
      return res.status(402).json({ error:"Upgrade to Starter or higher for AI SEO" });

    const prompt = `You are an SEO expert for African e-commerce. 
Generate SEO content for this product sold by "${req.user.name}" shop in Africa.

Product name: ${product.name}
Price: ${product.currency}${product.price}
Current description: ${product.description || "none"}

Return a JSON object with exactly these fields (no markdown, no extra text):
{
  "description": "SEO-optimised product description (80-120 words, includes product name, benefits, local relevance)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "metaTitle": "SEO meta title (50-60 chars max, includes product name and shop name)",
  "metaDesc": "Meta description (150-160 chars, compelling, includes call to action)",
  "slug": "url-friendly-slug",
  "score": 85
}`;

    const aiRes = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{ role:"user", content:prompt }]
    }, {
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      }
    });

    const raw = aiRes.data.content[0]?.text || "{}";
    const clean = raw.replace(/```json|```/g,"").trim();
    const seoData = JSON.parse(clean);

    // Upsert SEO content
    const seo = await SeoContent.findOneAndUpdate(
      { product:productId, owner:req.user._id },
      { ...seoData, product:productId, owner:req.user._id, generatedAt:new Date() },
      { upsert:true, new:true }
    );

    // Update product slug
    await Product.findByIdAndUpdate(productId, { seoSlug: seoData.slug || slugify(product.name, { lower:true, strict:true }) });

    res.json({ seo });
  } catch (e) { res.status(500).json({ error:"AI SEO failed: " + e.message }); }
});

// PATCH /api/ai-seo/:productId — manually save edits
router.patch("/:productId", async (req, res) => {
  try {
    const { description, keywords, metaTitle, metaDesc, slug } = req.body;
    const seo = await SeoContent.findOneAndUpdate(
      { product:req.params.productId, owner:req.user._id },
      { description, keywords, metaTitle, metaDesc, slug },
      { upsert:true, new:true }
    );
    if (slug) await Product.findOneAndUpdate({ _id:req.params.productId, owner:req.user._id }, { seoSlug:slug });
    res.json({ seo });
  } catch { res.status(500).json({ error:"Failed" }); }
});

module.exports = router;
