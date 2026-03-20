const mongoose = require("mongoose");
const s = new mongoose.Schema({
  agent:          { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  shop:           { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true },
  agentShop:      { type:mongoose.Schema.Types.ObjectId, ref:"AgentShop", required:true },
  order:          { type:mongoose.Schema.Types.ObjectId, ref:"Order", required:true },
  saleAmount:     { type:Number, required:true },   // total order value
  commissionPct:  { type:Number, required:true },   // % at time of sale
  commissionAmt:  { type:Number, required:true },   // actual naira earned
  shopAmount:     { type:Number, required:true },   // what shop owner keeps
  currency:       { type:String, default:"₦" },
  paid:           { type:Boolean, default:false },  // shop owner marked as paid
  paidAt:         { type:Date, default:null },
  note:           { type:String, default:"" },
}, { timestamps:true });
module.exports = mongoose.model("AgentSale", s);
