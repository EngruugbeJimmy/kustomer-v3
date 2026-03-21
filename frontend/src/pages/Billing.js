import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const PACKS = [
  { key:"starter", credits:50,   price:"₦200",   tag:"Try it",    best:false, desc:"Good for 50 WA broadcasts" },
  { key:"small",   credits:150,  price:"₦500",   tag:"Popular",   best:true,  desc:"150 WA or 50 emails + AI SEO" },
  { key:"medium",  credits:400,  price:"₦1,200", tag:"Best value",best:false, desc:"400 WA or mix of features" },
  { key:"large",   credits:1000, price:"₦2,500", tag:"Growth",    best:false, desc:"For active shops" },
  { key:"bulk",    credits:3000, price:"₦6,000", tag:"Agency",    best:false, desc:"For resellers and agents" },
];

const GUIDE = [
  { feature:"WhatsApp broadcast", cost:"1 credit",  icon:"💬" },
  { feature:"Email campaign",      cost:"1 credit",  icon:"📧" },
  { feature:"SMS message",         cost:"3 credits", icon:"📱" },
  { feature:"AI SEO (1 product)",  cost:"5 credits", icon:"✨" },
  { feature:"Social post caption", cost:"3 credits", icon:"📸" },
  { feature:"YouTube script",      cost:"10 credits",icon:"📝" },
  { feature:"YouTube video",       cost:"40 credits",icon:"▶️" },
];

export default function Billing() {
  const { user, refresh }     = useAuth();
  const [sp]                  = useSearchParams();
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying]   = useState(null);
  const [tab, setTab]         = useState("topup");

  useEffect(() => {
    const s      = sp.get("status");
    const gained = sp.get("credits");
    if (s === "success") { toast.success("Credits added! +" + gained + " credits 🎉"); refresh(); }
    if (s === "failed")  toast.error("Payment failed. Try again.");
    api.get("/billing/status")
      .then(r => setStatus(r.data))
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const handleTopUp = async (pack) => {
    setBuying(pack);
    try {
      const r = await api.post("/billing/topup", { pack });
      window.location.href = r.data.authorization_url;
    } catch (err) { toast.error(err.response?.data?.error || "Payment failed"); setBuying(null); }
  };

  const total = (status?.credits || 0) + (status?.dailyCredits || 0);

  if (loading) return (
    <div className="page items-center justify-center">
      <div className="text-center"><p className="text-4xl mb-3 animate-bounce">⚡</p><p className="text-gray-400">Loading...</p></div>
    </div>
  );

  return (
    <div className="page pb-24">

      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <h1 className="font-display text-2xl font-bold text-white mb-4">Credits</h1>

        {/* Balance card */}
        <div className="bg-kgreen-800 rounded-2xl p-4 mb-3">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-kgreen-100 text-xs font-semibold uppercase tracking-wide mb-1">Total available</p>
              <p className="font-display text-5xl font-bold text-white">{total.toLocaleString()}</p>
              <p className="text-kgreen-100 text-xs mt-1">credits</p>
            </div>
            <div className="text-right">
              <div className="bg-kgreen-700 rounded-xl px-3 py-2 text-center">
                <p className="font-display font-bold text-xl text-kgold-300">{status?.dailyCredits || 0}</p>
                <p className="text-kgreen-100 text-xs">free today</p>
              </div>
            </div>
          </div>
          {/* Balance breakdown */}
          <div className="flex gap-3">
            <div className="flex-1 bg-kgreen-700 rounded-xl p-2.5 text-center">
              <p className="font-bold text-white text-lg">{(status?.credits || 0).toLocaleString()}</p>
              <p className="text-kgreen-100 text-xs">purchased</p>
            </div>
            <div className="flex-1 bg-kgreen-700 rounded-xl p-2.5 text-center">
              <p className="font-bold text-kgold-300 text-lg">{status?.dailyCredits || 0}</p>
              <p className="text-kgreen-100 text-xs">daily free</p>
            </div>
            <div className="flex-1 bg-kgreen-700 rounded-xl p-2.5 text-center">
              <p className="font-bold text-white text-lg">{(status?.totalUsed || 0).toLocaleString()}</p>
              <p className="text-kgreen-100 text-xs">used total</p>
            </div>
          </div>
        </div>

        {/* Daily free info */}
        <div className="bg-kgold-500 bg-opacity-20 rounded-xl px-3 py-2 flex items-center gap-2">
          <span style={{ fontSize:16 }}>🎁</span>
          <p className="text-kgold-300 text-xs font-semibold">
            You get {status?.dailyAmount || 10} free credits every day — resets at midnight
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-5 mt-4 flex bg-white rounded-2xl p-1 border border-gray-100 gap-1">
        {[["topup","⚡ Top Up"],["guide","📖 What it costs"],["history","🧾 History"]].map(([key,lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition-all
              ${tab === key ? "bg-kgreen-700 text-white shadow-sm" : "text-gray-400"}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* TOP UP TAB */}
      {tab === "topup" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          <div className="card bg-kgreen-50 border-kgreen-100 py-3">
            <p className="text-xs text-kgreen-700 leading-relaxed">
              Credits never expire. Daily free credits reset every midnight. Purchased credits carry over forever.
              Buy as little or as much as you need — just like airtime.
            </p>
          </div>

          {PACKS.map(pack => (
            <button key={pack.key} onClick={() => handleTopUp(pack.key)}
              disabled={buying === pack.key}
              className={`bg-white rounded-2xl p-4 text-left active:scale-[0.98] transition-all
                border ${pack.best ? "border-2 border-kgreen-700" : "border-gray-100"}`}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  {pack.best && (
                    <span className="bg-kgreen-700 text-white text-xs font-bold px-2.5 py-0.5 rounded-full mb-2 inline-block">
                      Most popular
                    </span>
                  )}
                  {!pack.best && (
                    <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2.5 py-0.5 rounded-full mb-2 inline-block">
                      {pack.tag}
                    </span>
                  )}
                  <p className="font-display font-bold text-2xl text-gray-900">
                    {pack.credits.toLocaleString()} <span className="text-base text-gray-400 font-normal">credits</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{pack.desc}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold text-2xl text-kgreen-700">{pack.price}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    ₦{Math.round(parseInt(pack.price.replace("₦","").replace(",","")) / pack.credits)} per credit
                  </p>
                </div>
              </div>
              {buying === pack.key && (
                <div className="mt-2 text-center text-xs text-kgreen-700 font-semibold">⏳ Opening payment...</div>
              )}
            </button>
          ))}

          <div className="card text-center py-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              Payments secured by Paystack · Cards, bank transfer, USSD supported
            </p>
          </div>
        </div>
      )}

      {/* GUIDE TAB */}
      {tab === "guide" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Credit cost per action</p>
            {GUIDE.map(({ feature, cost, icon }) => (
              <div key={feature} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span style={{ fontSize:20 }}>{icon}</span>
                  <p className="text-sm font-medium text-gray-700">{feature}</p>
                </div>
                <span className="bg-kgreen-50 text-kgreen-700 text-xs font-bold px-3 py-1 rounded-full">
                  {cost}
                </span>
              </div>
            ))}
          </div>

          <div className="card bg-kgold-50 border-kgold-100">
            <p className="text-xs font-bold text-kgold-700 uppercase tracking-wide mb-3">Free every day</p>
            {[
              ["💬","3 WhatsApp broadcasts","1 credit each"],
              ["✨","1 AI SEO generation","5 credits"],
              ["📸","1 social post caption","3 credits"],
              ["🛒","Unlimited orders","Always free"],
              ["👥","Unlimited customers","Always free"],
            ].map(([icon, feature, note]) => (
              <div key={feature} className="flex items-center gap-3 py-2 border-b border-kgold-100 last:border-0">
                <span style={{ fontSize:16 }}>{icon}</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-700">{feature}</p>
                  <p className="text-xs text-gray-400">{note}</p>
                </div>
                <span className="text-kgold-700 text-xs font-bold">Free</span>
              </div>
            ))}
          </div>

          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Example — ₦500 pack</p>
            {[
              ["150 WhatsApp broadcasts to customers"],
              ["150 email campaigns"],
              ["30 AI SEO generations for products"],
              ["37 social post captions"],
              ["3 YouTube video scripts"],
              ["Mix of all the above"],
            ].map(([txt]) => (
              <div key={txt} className="flex items-start gap-2 mb-2 last:mb-0">
                <span className="text-kgreen-600 font-bold text-sm mt-0.5">✓</span>
                <p className="text-sm text-gray-600">{txt}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {(!status?.transactions || status.transactions.length === 0) ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🧾</p>
              <p className="font-semibold text-gray-500">No transactions yet</p>
              <p className="text-xs text-gray-400 mt-1">Your top-up history will appear here</p>
            </div>
          ) : status.transactions.map(tx => (
            <div key={tx._id} className="card flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                ${tx.status === "success" ? "bg-kgreen-50" : "bg-amber-50"}`}>
                <span style={{ fontSize:18 }}>{tx.status === "success" ? "⚡" : "⏳"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">
                  {tx.meta?.credits ? "+" + tx.meta.credits + " credits" : "Top-up"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(tx.createdAt).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900 text-sm">
                  ₦{Math.round((tx.amount || 0) / 100).toLocaleString()}
                </p>
                <span className={`text-xs font-semibold ${tx.status === "success" ? "text-kgreen-700" : "text-amber-600"}`}>
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
