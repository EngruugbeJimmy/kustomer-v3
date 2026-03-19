const mongoose = require("mongoose");
const messageSchema = new mongoose.Schema({
  owner:          { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text:           { type: String, required: true, maxlength: 1000 },
  recipientCount: { type: Number, default: 0 },
  creditsUsed:    { type: Number, default: 0 },
  recipients:     [{ name: String, phone: String }],
}, { timestamps: true });
module.exports = mongoose.model("Message", messageSchema);
