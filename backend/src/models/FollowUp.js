const mongoose = require("mongoose");
const s = new mongoose.Schema({
  shop:        { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  customer:    { type:mongoose.Schema.Types.ObjectId, ref:"Customer", required:true },
  date:        { type:String, required:true },
  message:     { type:String, default:"" },
  catalogVisit:{ type:mongoose.Schema.Types.ObjectId, ref:"CatalogVisit", default:null },
  status:      { type:String, enum:["pending","sent","converted","skipped"], default:"pending" },
  sentAt:      { type:Date, default:null },
  convertedAt: { type:Date, default:null },
}, { timestamps:true });
s.index({ shop:1, customer:1, date:1 }, { unique:true });
module.exports = mongoose.model("FollowUp", s);
