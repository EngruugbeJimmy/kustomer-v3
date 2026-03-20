const mongoose = require("mongoose");
const s = new mongoose.Schema({
  agent:          { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  shop:           { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true },
  shopName:       { type:String, default:"" },
  shopSlug:       { type:String, default:"" },
  commissionPct:  { type:Number, default:10, min:1, max:50 }, // shop owner sets this
  status:         { type:String, enum:["pending","active","paused","removed"], default:"pending" },
  inviteCode:     { type:String, unique:true, sparse:true },   // unique per agent+shop
  totalSales:     { type:Number, default:0 },
  totalEarned:    { type:Number, default:0 },
  totalPaid:      { type:Number, default:0 },
  joinedAt:       { type:Date, default:null },
}, { timestamps:true });
s.index({ agent:1, shop:1 }, { unique:true });
module.exports = mongoose.model("AgentShop", s);
