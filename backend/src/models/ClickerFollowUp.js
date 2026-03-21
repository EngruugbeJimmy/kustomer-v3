const mongoose = require("mongoose");
const s = new mongoose.Schema({
  shop:       { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  customer:   { type:mongoose.Schema.Types.ObjectId, ref:"Customer", required:true },
  date:       { type:String, required:true },         // YYYY-MM-DD
  message:    { type:String, default:"" },            // personalised follow-up
  products:   [String],                               // products they viewed
  sent:       { type:Boolean, default:false },
  sentAt:     { type:Date, default:null },
  converted:  { type:Boolean, default:false },        // did they order after?
  orderedAt:  { type:Date, default:null },
}, { timestamps:true });
s.index({ shop:1, customer:1, date:1 }, { unique:true });
module.exports = mongoose.model("ClickerFollowUp", s);
