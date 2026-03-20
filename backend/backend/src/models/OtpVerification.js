const mongoose = require("mongoose");
const s = new mongoose.Schema({
  phone:     { type:String, required:true, index:true },
  otp:       { type:String, required:true },      // hashed OTP stored — never plaintext
  attempts:  { type:Number, default:0 },          // wrong attempts counter
  verified:  { type:Boolean, default:false },
  expiresAt: { type:Date, required:true, index:{ expireAfterSeconds:0 } }, // TTL index — auto-deletes
  userId:    { type:mongoose.Schema.Types.ObjectId, ref:"User", default:null },
  ip:        { type:String, default:"" },
}, { timestamps:true });
// Compound index: one active OTP per phone at a time
s.index({ phone:1, verified:false });
module.exports = mongoose.model("OtpVerification", s);
