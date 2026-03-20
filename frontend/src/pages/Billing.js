import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import PlanBadge from "../components/PlanBadge";

const PLAN_INFO = {
  free:     { label:"Free",     price:"₦0",     sub:"/month",  color:"gray",
    features:["50 customers","30 WA credits/month","1 catalog page","Free subdomain"] },
  starter:  { label:"Starter",  price:"₦1,500", sub:"/month",  color:"green", popular:true,
    features:["300 customers","200 WA credits/month","SMS + Email marketing","AI SEO (5 products)","Social post generator"] },
  pro:      { label:"Pro",      price:"₦3,500", sub:"/month",  color:"gold",
    features:["Unlimited customers","500 WA credits/month","Full AI SEO suite","Custom shop domain","All social channels"] },
  reseller: { label:"Reseller", price:"₦5,000", sub:"/month",  color:"purple",
    features:["Everything in Pro","40% commission on referrals","Reseller dashboard","Agent sub-accounts","Priority support"] },
};

const WA_PACKS = [
  { key:"wa100",  label:"100 sends",   price:"₦400",   per:"₦4/send",    best:false },
  { key:"wa500",  label:"500 sends",   price:"₦1,500", per:"₦3/send",    best:true  },
  { key:"wa2000", label:"2,000 sends", price:"₦5,000", per:"₦2.50/send", best:false },
];

const VIDEO_PACKS = [
  { key:"vid1",  label:"1 video",   price:"₦500",   per:"₦500/video",  tag:"Try it",  best:false },
  { key:"vid3",  label:"3 videos",  price:"₦1,200", per:"₦400/video",  tag:"Starter", best:true  },
  { key:"vid10", label:"10 videos", price:"₦3,500", per:"₦350/video",  tag:"Growth",  best:false },
  { key:"vid30", label:"30 videos", price:"₦9,000", per:"₦300/video",  tag:"Agency",  best:false },
];

export default function Billing() {
  const { user, refresh }         = useAuth();
  const navigate                  = useNavigate();
  const [sp]                      = useSearchParams();
  const [loading, setLoading]     = useState(false);
  const [txs, setTxs]             = useState([]);
  const [tab, setTab]             = useState("plans");

  useEffect(() => {
    const status = sp.get("status");
    if (status === "success") { toast.success("Payment successful! 🎉"); refresh(); }
    else if (status === "failed") toast.error("Payment failed. Try again.");
    api.get("/billing/me").then(r => setTxs(r.data.transactions || [])).catch(() => {});
  }, []);

  const handleSubscribe = async (plan) => {
    if (plan === (user?.plan || "free")) { toast("You're already on this plan"); return; }
    if (plan === "free") { toast.error("Cannot downgrade to free"); return; }
    setLoading(true);
    try {
      const res = await api.post("/billing/subscribe", { plan });
      window.location.href = res.data.authorization_url;
    } catch (err) { toast.error(err.response?.data?.error || "Payment failed"); }
    finally { setLoading(false); }
  };

  const handleCredits = async (pack) => {
    setLoading(true);
    try {
      const res = await api.post("/billing/buy-credits", { pack });
      window.location.href = res.data.authorization_url;
    } catch (err) { toast.error(err.response?.data?.error || "Payment failed"); }
    finally { setLoading(false); }
  };

  const handleVideoCredits = async (pack) => {
    setLoading(true);
    try {
      const res = await api.post("/billing/buy-video-credits", { pack });
      window.location.href = res.data.authorization_url;
    } catch (err) { toast.error(err.response?.data?.error || "Payment failed"); }
    finally { setLoading(false); }
  };

  const currentPlan = user?.plan || "free";

  return (
    <div className="page pb-24">

      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-6 rounded-b-[2rem]">
        <h1 className="font-display text-2xl font-bold text-white mb-1">Plans & Credits</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-kgreen-100 text-sm">Current:</span>
          <PlanBadge plan={currentPlan} />
          <span className="text-kgreen-100 text-sm">·</span>
          <span className="text-kgreen-100 text-sm">{(user?.credits || 0).toLocaleString()} WA</span>
          <span className="text-kgreen-100 text-sm">·</span>
          <span className="text-kgreen-100 text-sm">{(user?.videoCredits || 0)} videos</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-5 mt-4 flex bg-white rounded-2xl p-1 border border-gray-100 gap-1">
        {[["plans","📋 Plans"],["credits","⚡ WA Credits"],["videos","▶️ YouTube"],["history","🧾 History"]].map(([key,lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-xl font-semibold text-[10px] transition-all
              ${tab === key ? "bg-kgreen-700 text-white shadow-sm" : "text-gray-400"}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── PLANS ── */}
      {tab === "plans" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">

          {/* Free */}
          <div className={`bg-white rounded-2xl p-4 border ${currentPlan === "free" ? "border-2 border-gray-300" : "border-gray-100"}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-lg text-gray-900">Free</span>
                  {currentPlan === "free" && <span className="badge-green">Current</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-2xl text-gray-400">₦0</p>
                <p className="text-gray-400 text-xs">forever</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {PLAN_INFO.free.features.map(f => (
                <div key={f} className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">✓</span>
                  <span className="text-sm text-gray-500">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Paid plans */}
          {["starter","pro","reseller"].map(planKey => {
            const info      = PLAN_INFO[planKey];
            const isCurrent = currentPlan === planKey;
            const borderCls = isCurrent       ? "border-2 border-kgreen-700" :
                              info.popular     ? "border-2 border-kgold-500"  :
                              planKey==="reseller" ? "border-2 border-purple-400" : "border-gray-100";
            const btnCls    = planKey === "pro"      ? "btn-gold" :
                              planKey === "reseller" ? "bg-purple-600 text-white font-semibold py-4 px-6 rounded-2xl active:scale-95 transition-all w-full text-base shadow-lg" : "btn-green";
            return (
              <div key={planKey} className={`bg-white rounded-2xl p-4 border ${borderCls}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-lg text-gray-900">{info.label}</span>
                      {info.popular    && <span className="badge-gold">Popular</span>}
                      {planKey==="reseller" && <span className="badge-purple">Earn back</span>}
                      {isCurrent       && <span className="badge-green">Current</span>}
                    </div>
                    {planKey === "reseller" && (
                      <p className="text-xs text-purple-600 mt-1">Earn ₦600/shop/month — pays for itself at 9 shops</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-2xl text-kgreen-700">{info.price}</p>
                    <p className="text-gray-400 text-xs">{info.sub}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 mb-4">
                  {info.features.map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <span className="text-kgreen-600 text-sm font-bold">✓</span>
                      <span className="text-sm text-gray-600">{f}</span>
                    </div>
                  ))}
                </div>
                {isCurrent ? (
                  <div className="bg-kgreen-50 rounded-xl p-3 text-center">
                    <p className="text-kgreen-700 text-sm font-semibold">✓ Your current plan</p>
                  </div>
                ) : (
                  <button onClick={() => handleSubscribe(planKey)} disabled={loading} className={btnCls}>
                    {loading ? "⏳..." : `Upgrade to ${info.label} — ${info.price}/mo`}
                  </button>
                )}
              </div>
            );
          })}

          {/* Value reminder */}
          <div className="card bg-kgreen-50 border-kgreen-100 py-3">
            <p className="text-xs text-kgreen-700 text-center leading-relaxed">
              💡 Starter at ₦1,500/month = same as one data bundle.
              Top up WA credits, SMS, and YouTube videos separately anytime — no plan upgrade needed.
            </p>
          </div>
        </div>
      )}

      {/* ── WA CREDITS ── */}
      {tab === "credits" && (
        <div className="mx-5 mt-4">
          <div className="bg-kgreen-700 rounded-2xl p-4 mb-4">
            <p className="text-kgreen-100 text-xs font-semibold uppercase tracking-wide mb-1">Available WA Credits</p>
            <p className="font-display text-4xl font-bold text-white">{(user?.credits || 0).toLocaleString()}</p>
            <p className="text-kgreen-100 text-xs mt-1">broadcast sends · no expiry</p>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-1">Buy WhatsApp credit packs</p>
          <div className="flex flex-col gap-3 mb-5">
            {WA_PACKS.map(pack => (
              <button key={pack.key} onClick={() => handleCredits(pack.key)} disabled={loading}
                className={`bg-white rounded-2xl p-4 text-left active:scale-95 transition-all flex items-center justify-between
                  border ${pack.best ? "border-2 border-kgreen-700" : "border-gray-100"}`}>
                <div>
                  {pack.best && <span className="bg-kgreen-700 text-white text-xs font-bold px-2.5 py-0.5 rounded-full mb-1.5 inline-block">Best value</span>}
                  <p className="font-display font-bold text-xl text-gray-900">{pack.label}</p>
                  <p className="text-xs text-gray-400">{pack.per}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold text-kgreen-700 text-xl">{pack.price}</p>
                  <p className="text-xs text-gray-400 mt-1">tap to pay</p>
                </div>
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400">Pay via Paystack · Cards · Bank Transfer · USSD</p>
        </div>
      )}

      {/* ── YOUTUBE VIDEO CREDITS ── */}
      {tab === "videos" && (
        <div className="mx-5 mt-4">
          {/* Balance */}
          <div className="bg-red-500 rounded-2xl p-4 mb-4">
            <p className="text-red-100 text-xs font-semibold uppercase tracking-wide mb-1">Video Credits</p>
            <p className="font-display text-4xl font-bold text-white">{user?.videoCredits || 0}</p>
            <p className="text-red-100 text-xs mt-1">YouTube videos remaining · no expiry</p>
          </div>

          {/* What you get */}
          <div className="card bg-red-50 border-red-100 mb-4">
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">What one credit gives you</p>
            {[
              ["🤖","AI writes a 45-second product video script"],
              ["🎙️","Nigerian-accented voiceover generated automatically"],
              ["🎬","Product slideshow video — no editing needed"],
              ["📤","Published to your YouTube channel in one tap"],
              ["🔍","SEO title, description and tags auto-generated"],
              ["🛒","Shop link in every video description"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-2 mb-2 last:mb-0">
                <span style={{ fontSize:14 }}>{icon}</span>
                <p className="text-xs text-gray-600">{text}</p>
              </div>
            ))}
          </div>

          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-1">Buy video credits</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {VIDEO_PACKS.map(pack => (
              <button key={pack.key} onClick={() => handleVideoCredits(pack.key)} disabled={loading}
                className={`bg-white rounded-2xl p-4 text-left active:scale-95 transition-all
                  border ${pack.best ? "border-2 border-red-500" : "border-gray-100"}`}>
                {pack.best && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full mb-2 inline-block">Best value</span>}
                {!pack.best && <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full mb-2 inline-block">{pack.tag}</span>}
                <p className="font-display font-bold text-xl text-gray-900">{pack.label}</p>
                <p className="text-xs text-gray-400 mb-2">{pack.per}</p>
                <p className="font-display font-bold text-red-500 text-lg">{pack.price}</p>
              </button>
            ))}
          </div>

          <div className="card bg-amber-50 border-amber-100">
            <p className="text-xs text-amber-700 leading-relaxed">
              💡 Start with the "Try it" pack for just ₦500. If your first video drives even 2 extra sales,
              it has already paid for itself. No subscription needed — works on all plans including Free.
            </p>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === "history" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {txs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🧾</p>
              <p className="text-gray-400 font-medium text-sm">No transactions yet</p>
            </div>
          ) : txs.map(tx => (
            <div key={tx._id} className="card flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0
                ${tx.status === "success" ? "bg-kgreen-50" : tx.status === "pending" ? "bg-amber-50" : "bg-red-50"}`}>
                <span style={{ fontSize:16 }}>
                  {tx.type === "video_credits" ? "▶️" : tx.type === "credits" ? "⚡" : "💳"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm capitalize">
                  {tx.type === "video_credits" ? "YouTube credits" :
                   tx.type === "credits"        ? "WA credits top-up" :
                   "Subscription — " + tx.plan}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(tx.createdAt).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
                  {tx.meta?.videos && " · " + tx.meta.videos + " videos"}
                  {tx.meta?.sends  && " · " + tx.meta.sends  + " sends"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900 text-sm">₦{Math.round(tx.amount / 100).toLocaleString()}</p>
                <span className={`text-xs font-semibold
                  ${tx.status === "success" ? "text-kgreen-700" :
                    tx.status === "pending"  ? "text-amber-600"  : "text-red-500"}`}>
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
