const mongoose = require("mongoose");
const s = new mongoose.Schema({
  owner:        { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true, index:true },
  name:         { type:String, required:true, trim:true, maxlength:60 },
  phone:        { type:String, required:true, trim:true },
  email:        { type:String, trim:true, lowercase:true, default:"" },
  notes:        { type:String, trim:true, maxlength:200 },
  // Buyer intelligence
  buyerTag:     { type:String, enum:["hot","buyer","clicker","ghost","new"], default:"new" },
  totalOrders:  { type:Number, default:0 },
  totalSpent:   { type:Number, default:0 },
  lastOrderAt:  { type:Date, default:null },
  lastSeenAt:   { type:Date, default:null },   // last catalog visit
  catalogVisits:{ type:Number, default:0 },
  cartAbandons: { type:Number, default:0 },
  broadcastsReceived: { type:Number, default:0 },
  broadcastsOpened:   { type:Number, default:0 },
  favoriteProducts:   [String],               // product IDs ordered most
}, { timestamps:true });
s.index({ owner:1, phone:1 }, { unique:true });

// Auto-compute buyerTag based on behaviour
s.methods.computeTag = function() {
  if (this.totalOrders >= 5) return "hot";
  if (this.totalOrders >= 1) return "buyer";
  if (this.catalogVisits >= 1) return "clicker";
  if (this.broadcastsReceived >= 1) return "ghost";
  return "new";
};
module.exports = mongoose.model("Customer", s);
