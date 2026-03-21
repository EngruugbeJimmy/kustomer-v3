const mongoose = require("mongoose");
const s = new mongoose.Schema({
  shop:        { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  date:        { type:String, required:true },          // YYYY-MM-DD
  status:      { type:String, enum:["draft","approved","sent","skipped"], default:"draft" },
  product:     { type:mongoose.Schema.Types.ObjectId, ref:"Product", default:null },
  productName: { type:String, default:"" },
  // AI-generated content
  waMessage:   { type:String, default:"" },   // WhatsApp broadcast
  waStatus:    { type:String, default:"" },   // WhatsApp Status
  facebook:    { type:String, default:"" },
  instagram:   { type:String, default:"" },
  tiktok:      { type:String, default:"" },
  // What AI decided and why
  aiReasoning: { type:String, default:"" },
  // Execution tracking
  waSentAt:    { type:Date, default:null },
  waRecipients:{ type:Number, default:0 },
  fbPostedAt:  { type:Date, default:null },
  igPostedAt:  { type:Date, default:null },
  approvedAt:  { type:Date, default:null },
  skippedAt:   { type:Date, default:null },
  // Credits used
  creditsUsed: { type:Number, default:0 },
  // Edited by owner before approval
  editedByOwner:{ type:Boolean, default:false },
}, { timestamps:true });

s.index({ shop:1, date:1 }, { unique:true });
module.exports = mongoose.model("DailyBriefing", s);
