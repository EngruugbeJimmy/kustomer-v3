const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const slugify  = require("slugify");

// ── Plan definitions ─────────────────────────────────────────
const PLANS = {
  free:    { name: "Free",    customerLimit: 50,   monthlyCredits: 30,   price: 0 },
  starter: { name: "Starter", customerLimit: 300,  monthlyCredits: 500,  price: 2500 },
  pro:     { name: "Pro",     customerLimit: -1,   monthlyCredits: 2000, price: 6500 },
};

const userSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true, maxlength: 60 },
  email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:        { type: String, required: true, minlength: 6 },
  phone:           { type: String, trim: true },
  shopSlug:        { type: String, unique: true, lowercase: true },
  shopDescription: { type: String, trim: true, maxlength: 200, default: "Welcome to our shop!" },
  shopLogoUrl:     { type: String, default: "" },

  // Billing
  plan:            { type: String, enum: ["free","starter","pro"], default: "free" },
  credits:         { type: Number, default: 30 },
  creditsUsed:     { type: Number, default: 0 },
  planExpiresAt:   { type: Date, default: null },
  paystackCustomerId: { type: String, default: "" },

  // Reseller
  isReseller:      { type: Boolean, default: false },
  resellerCode:    { type: String, unique: true, sparse: true },
  referredBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  resellerEarnings:{ type: Number, default: 0 },
}, { timestamps: true });

userSchema.pre("save", async function(next) {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 10);
  if (!this.shopSlug) {
    const base   = slugify(this.name, { lower: true, strict: true });
    const suffix = Math.random().toString(36).slice(2, 6);
    this.shopSlug = base + "-" + suffix;
  }
  next();
});

userSchema.methods.comparePassword = function(p) { return bcrypt.compare(p, this.password); };
userSchema.methods.toJSON = function() { const o = this.toObject(); delete o.password; return o; };
userSchema.statics.PLANS = PLANS;

module.exports = mongoose.model("User", userSchema);
