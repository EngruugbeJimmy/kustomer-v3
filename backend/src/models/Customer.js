const mongoose = require("mongoose");
const customerSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name:  { type: String, required: true, trim: true, maxlength: 60 },
  phone: { type: String, required: true, trim: true },
  notes: { type: String, trim: true, maxlength: 200 },
}, { timestamps: true });
customerSchema.index({ owner: 1, phone: 1 }, { unique: true });
module.exports = mongoose.model("Customer", customerSchema);
