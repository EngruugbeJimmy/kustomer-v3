const mongoose = require("mongoose");
const s = new mongoose.Schema({
  shop:       { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  reporter:   { type:String, default:"" },        // IP or userId — anonymous allowed
  reason:     { type:String, enum:["fake_shop","scam","impersonation","wrong_info","other"], required:true },
  detail:     { type:String, default:"", maxlength:500 },
  resolved:   { type:Boolean, default:false },
  resolvedAt: { type:Date, default:null },
  action:     { type:String, enum:["dismissed","warned","suspended","banned",""], default:"" },
}, { timestamps:true });
module.exports = mongoose.model("ShopReport", s);
