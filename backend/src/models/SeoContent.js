const mongoose = require("mongoose");
const seoSchema = new mongoose.Schema({
  owner:       { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true },
  product:     { type:mongoose.Schema.Types.ObjectId, ref:"Product", required:true, unique:true },
  description: { type:String, default:"" },
  keywords:    [String],
  metaTitle:   { type:String, default:"" },
  metaDesc:    { type:String, default:"" },
  slug:        { type:String, default:"" },
  score:       { type:Number, default:0 },
  generatedAt: { type:Date, default:Date.now },
}, { timestamps:true });
module.exports = mongoose.model("SeoContent", seoSchema);
