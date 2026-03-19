const express  = require("express");
const { body, validationResult } = require("express-validator");
const Product  = require("../models/Product");
const auth     = require("../middleware/auth");
const { upload, cloudinary } = require("../middleware/upload");
const router   = express.Router();
router.use(auth);

router.get("/", async (req, res) => {
  try {
    const products = await Product.find({ owner: req.user._id }).sort({ sortOrder:1, createdAt:-1 });
    res.json({ products });
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.post("/", upload.single("image"), [
  body("name").trim().notEmpty(),
  body("price").isFloat({ min: 0 })
], async (req, res) => {
  try {
    const err = validationResult(req);
    if (!err.isEmpty()) return res.status(400).json({ error: err.array()[0].msg });
    const { name, description, price, currency, inStock } = req.body;
    const product = await Product.create({
      owner: req.user._id, name, description: description||"",
      price: parseFloat(price), currency: currency||"₦",
      inStock: inStock !== "false",
      imageUrl: req.file?.path||"", imagePublicId: req.file?.filename||""
    });
    res.status(201).json({ product });
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.patch("/:id", upload.single("image"), async (req, res) => {
  try {
    const p = await Product.findOne({ _id: req.params.id, owner: req.user._id });
    if (!p) return res.status(404).json({ error: "Not found" });
    const { name, description, price, currency, inStock } = req.body;
    if (name)        p.name        = name;
    if (description !== undefined) p.description = description;
    if (price)       p.price       = parseFloat(price);
    if (currency)    p.currency    = currency;
    if (inStock !== undefined) p.inStock = inStock !== "false";
    if (req.file) {
      if (p.imagePublicId) await cloudinary.uploader.destroy(p.imagePublicId).catch(()=>{});
      p.imageUrl = req.file.path; p.imagePublicId = req.file.filename;
    }
    await p.save();
    res.json({ product: p });
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const p = await Product.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.imagePublicId) await cloudinary.uploader.destroy(p.imagePublicId).catch(()=>{});
    res.json({ message: "Deleted" });
  } catch { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
