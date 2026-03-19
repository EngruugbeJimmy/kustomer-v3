const mongoose = require("mongoose");
const txSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type:        { type: String, enum: ["subscription","credits","reseller_payout"], required: true },
  amount:      { type: Number, required: true },
  credits:     { type: Number, default: 0 },
  plan:        { type: String, default: "" },
  reference:   { type: String, unique: true },
  status:      { type: String, enum: ["pending","success","failed"], default: "pending" },
  paystackRef: { type: String, default: "" },
  meta:        { type: Object, default: {} },
}, { timestamps: true });
module.exports = mongoose.model("Transaction", txSchema);
