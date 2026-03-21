const mongoose = require("mongoose");
const s = new mongoose.Schema({
  shop:          { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  platform:      { type:String, enum:["facebook","instagram","tiktok"], required:true },
  // Page identity
  pageId:        { type:String, default:"" },
  pageName:      { type:String, default:"" },
  pageUrl:       { type:String, default:"" },
  profileImage:  { type:String, default:"" },
  // Auth tokens
  accessToken:   { type:String, default:"" },
  tokenExpiry:   { type:Date, default:null },
  // Status
  status:        { type:String, enum:["pending","connected","error","disconnected"], default:"pending" },
  connectedAt:   { type:Date, default:null },
  // Stats
  followers:     { type:Number, default:0 },
  totalPosts:    { type:Number, default:0 },
  totalBoosts:   { type:Number, default:0 },
  totalSpentOnBoosts: { type:Number, default:0 },
}, { timestamps:true });
s.index({ shop:1, platform:1 }, { unique:true });
module.exports = mongoose.model("SocialPage", s);
