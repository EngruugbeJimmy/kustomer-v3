const express  = require("express");
const Message  = require("../models/Message");
const User     = require("../models/User");
const auth     = require("../middleware/auth");
const router   = express.Router();
router.use(auth);

router.post("/", async (req, res) => {
  try {
    const { text, recipients } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Message required" });
    const count = recipients?.length || 0;
    // Deduct credits
    if (req.user.credits < count)
      return res.status(402).json({ error: "Not enough credits", credits: req.user.credits, needed: count });
    await User.findByIdAndUpdate(req.user._id, { $inc: { credits: -count, creditsUsed: count } });
    const msg = await Message.create({
      owner: req.user._id, text: text.trim(),
      recipientCount: count, creditsUsed: count,
      recipients: recipients?.map(r=>({ name:r.name, phone:r.phone })) || []
    });
    res.status(201).json({ data: msg, creditsRemaining: req.user.credits - count });
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/", async (req, res) => {
  try {
    const messages = await Message.find({ owner: req.user._id })
      .sort({ createdAt: -1 }).limit(20).lean();
    res.json({ messages });
  } catch { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
