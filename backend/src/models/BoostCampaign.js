const mongoose = require("mongoose");
const s = new mongoose.Schema({
  shop:          { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  socialPage:    { type:mongoose.Schema.Types.ObjectId, ref:"SocialPage", required:true },
  platform:      { type:String, enum:["facebook","instagram"], required:true },
  // The post being boosted
  postId:        { type:String, default:"" },      // Facebook post ID
  postContent:   { type:String, default:"" },      // preview of what was boosted
  // Campaign settings
  budgetNaira:   { type:Number, required:true },
  durationDays:  { type:Number, default:3 },
  targetLocation:{ type:String, default:"Nigeria" },
  targetAudience:{ type:String, default:"" },
  // Meta Ads
  adCampaignId:  { type:String, default:"" },
  adSetId:       { type:String, default:"" },
  adId:          { type:String, default:"" },
  // Status
  status:        { type:String, enum:["pending","active","completed","failed","cancelled"], default:"pending" },
  startedAt:     { type:Date, default:null },
  endedAt:       { type:Date, default:null },
  // Results
  reach:         { type:Number, default:0 },
  clicks:        { type:Number, default:0 },
  orders:        { type:Number, default:0 },
  error:         { type:String, default:"" },
}, { timestamps:true });
module.exports = mongoose.model("BoostCampaign", s);
