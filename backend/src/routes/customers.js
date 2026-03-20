const express = require("express");
const { body, validationResult } = require("express-validator");
const Customer = require("../models/Customer");
const User     = require("../models/User");
const auth     = require("../middleware/auth");
const router   = express.Router();
router.use(auth);

router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const q = { owner:req.user._id };
    if (search?.trim()) q.$or = [{ name:{ $regex:search.trim(),$options:"i" } },{ phone:{ $regex:search.trim(),$options:"i" } }];
    const customers = await Customer.find(q).sort({ createdAt:-1 }).lean();
    res.json({ customers, total:customers.length });
  } catch { res.status(500).json({ error:"Failed" }); }
});
router.get("/count", async (req, res) => {
  try { res.json({ count: await Customer.countDocuments({ owner:req.user._id }) }); }
  catch { res.status(500).json({ error:"Failed" }); }
});
router.post("/", [body("name").trim().notEmpty(), body("phone").trim().notEmpty()], async (req, res) => {
  try {
    const err = validationResult(req);
    if (!err.isEmpty()) return res.status(400).json({ error:err.array()[0].msg });
    const plan = User.PLANS[req.user.plan] || User.PLANS.free;
    const current = await Customer.countDocuments({ owner:req.user._id });
    if (plan.customerLimit > 0 && current >= plan.customerLimit)
      return res.status(402).json({ error:"Customer limit reached. Upgrade your plan." });
    const { name, phone, email, notes } = req.body;
    const customer = await Customer.create({ owner:req.user._id, name, phone:phone.replace(/[\s\-()]/g,""), email:email||"", notes });
    res.status(201).json({ customer });
  } catch (e) {
    if (e.code===11000) return res.status(400).json({ error:"Phone already saved" });
    res.status(500).json({ error:"Failed" });
  }
});
router.delete("/:id", async (req, res) => {
  try { await Customer.findOneAndDelete({ _id:req.params.id, owner:req.user._id }); res.json({ message:"Removed" }); }
  catch { res.status(500).json({ error:"Failed" }); }
});
module.exports = router;
