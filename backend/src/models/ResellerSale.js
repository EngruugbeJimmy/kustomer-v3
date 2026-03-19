const mongoose = require("mongoose");
const rsSchema = new mongoose.Schema({
  reseller:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  shop:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  shopName:    { type: String },
  plan:        { type: String },
  amount:      { type: Number },
  commission:  { type: Number },
  paid:        { type: Boolean, default: false },
}, { timestamps: true });
module.exports = mongoose.model("ResellerSale", rsSchema);
