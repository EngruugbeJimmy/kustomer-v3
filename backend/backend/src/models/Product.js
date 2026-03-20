const mongoose = require("mongoose");
const productSchema = new mongoose.Schema({
  owner:         { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  name:          { type:String, required:true, trim:true, maxlength:80 },
  description:   { type:String, trim:true, maxlength:500, default:"" },
  price:         { type:Number, required:true, min:0 },
  currency:      { type:String, default:"₦", maxlength:5 },
  imageUrl:      { type:String, default:"" },
  imagePublicId: { type:String, default:"" },
  inStock:       { type:Boolean, default:true },
  sortOrder:     { type:Number, default:0 },
  seoSlug:       { type:String, default:"" },
}, { timestamps:true });
module.exports = mongoose.model("Product", productSchema);
