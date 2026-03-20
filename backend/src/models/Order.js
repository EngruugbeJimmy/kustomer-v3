const mongoose = require("mongoose");
const s = new mongoose.Schema({
  shop:       { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  customer:   { type:mongoose.Schema.Types.ObjectId, ref:"Customer", required:true },
  campaign:   { type:mongoose.Schema.Types.ObjectId, ref:"Campaign", default:null },
  items:      [{ productId:String, name:String, qty:Number, price:Number, currency:String }],
  total:      { type:Number, default:0 },
  currency:   { type:String, default:"₦" },
  orderType:  { type:String, enum:["pickup","delivery"], default:"pickup" },
  status:     { type:String, enum:["pending","confirmed","cancelled"], default:"pending" },
  note:       { type:String, default:"" },
  confirmedAt:{ type:Date, default:null },
  source:     { type:String, enum:["catalog","whatsapp","direct"], default:"catalog" },
  agentCode:  { type:String, default:"" },  // agent attribution
}, { timestamps:true });
module.exports = mongoose.model("Order", s);
