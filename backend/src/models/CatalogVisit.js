const mongoose = require("mongoose");
const s = new mongoose.Schema({
  shop:       { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  customer:   { type:mongoose.Schema.Types.ObjectId, ref:"Customer", default:null },
  campaign:   { type:mongoose.Schema.Types.ObjectId, ref:"Campaign", default:null },
  trackingId: { type:String, index:true },  // unique per customer per broadcast
  ip:         { type:String, default:"" },
  userAgent:  { type:String, default:"" },
  addedToCart:{ type:Boolean, default:false },
  cartItems:  [{ productId:String, name:String, qty:Number, price:Number }],
  orderedAt:  { type:Date, default:null },    // when WhatsApp order was initiated
  source:     { type:String, enum:["broadcast","direct","discover","unknown"], default:"unknown" },
}, { timestamps:true });
module.exports = mongoose.model("CatalogVisit", s);
