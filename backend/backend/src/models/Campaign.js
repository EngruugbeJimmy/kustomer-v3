const mongoose = require("mongoose");
const campaignSchema = new mongoose.Schema({
  owner:          { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  channel:        { type:String, enum:["whatsapp","sms","email","status","tiktok","facebook","instagram"], required:true },
  subject:        { type:String, default:"" },
  message:        { type:String, required:true, maxlength:2000 },
  mediaUrl:       { type:String, default:"" },
  recipientCount: { type:Number, default:0 },
  creditsUsed:    { type:Number, default:0 },
  status:         { type:String, enum:["sent","draft","scheduled"], default:"sent" },
  recipients:     [{ name:String, phone:String, email:String }],
  scheduledFor:   { type:Date, default:null },
}, { timestamps:true });
module.exports = mongoose.model("Campaign", campaignSchema);
