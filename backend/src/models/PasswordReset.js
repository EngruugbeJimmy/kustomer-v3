const mongoose = require("mongoose");
const s = new mongoose.Schema({
  userId:    { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  token:     { type:String, required:true, index:true },  // hashed — never plaintext
  expiresAt: { type:Date, required:true, index:{ expireAfterSeconds:0 } }, // TTL — auto-deletes
  used:      { type:Boolean, default:false },
  ip:        { type:String, default:"" },
}, { timestamps:true });
module.exports = mongoose.model("PasswordReset", s);
