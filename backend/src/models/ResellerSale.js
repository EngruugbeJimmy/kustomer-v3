const mongoose = require("mongoose");
const s = new mongoose.Schema({
  reseller:   { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  shop:       { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true },
  shopName:   String, plan:String, amount:Number, commission:Number, paid:{ type:Boolean, default:false },
}, { timestamps:true });
module.exports = mongoose.model("ResellerSale", s);
