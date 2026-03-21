const mongoose = require("mongoose");
const s = new mongoose.Schema({
  shop:        { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  date:        { type:String, required:true },       // "2026-03-20" — one per shop per day
  status:      { type:String, enum:["draft","approved","sent","skipped"], default:"draft" },
  product:     { type:mongoose.Schema.Types.ObjectId, ref:"Product", default:null },
  productName: { type:String, default:"" },
  // AI drafted content
  waMessage:   { type:String, default:"" },          // WhatsApp broadcast
  waStatus:    { type:String, default:"" },          // WhatsApp Status
  facebook:    { type:String, default:"" },
  instagram:   { type:String, default:"" },
  tiktok:      { type:String, default:"" },
  // Insight that drove the content choice
  insight:     { type:String, default:"" },
  // Execution results
  waSentCount: { type:Number, default:0 },
  approvedAt:  { type:Date, default:null },
  sentAt:      { type:Date, default:null },
  // Shop owner edits before approving
  edited:      { type:Boolean, default:false },
  // Clicker follow-up (added by 6pm job)
  clickerFollowUp:      { type:String, default:"" },
  clickerCount:         { type:Number, default:0 },
  clickerFollowUpSentAt:{ type:Date, default:null },
}, { timestamps:true });

// One brief per shop per day
s.index({ shop:1, date:1 }, { unique:true });
module.exports = mongoose.model("DailyBrief", s);
