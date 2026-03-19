import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import PlanBadge from "../components/PlanBadge";

const PLAN_INFO = {
  free:    { label:"Free",    price:"₦0",     sub:"/month",  features:["50 customers","30 credits/month","1 catalog","Basic broadcast"], color:"gray" },
  starter: { label:"Starter", price:"₦2,500", sub:"/month",  features:["300 customers","500 credits/month","Full analytics","Priority support"], color:"green", popular:true },
  pro:     { label:"Pro",     price:"₦6,500", sub:"/month",  features:["Unlimited customers","2,000 credits/month","Multiple catalogs","Custom shop domain"], color:"gold" },
};

const CREDIT_PACKS = [
  { key:"pack100",  sends:100,  price:"₦500",    tag:"₦5/send",   best:false },
  { key:"pack500",  sends:500,  price:"₦2,000",  tag:"₦4/send",   best:true },
  { key:"pack1000", sends:1000, price:"₦3,500",  tag:"₦3.5/send", best:false },
  { key:"pack5000", sends:5000, price:"₦15,000", tag:"₦3/send",   best:false },
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
    api.get("/billing/me").then(r => setTxs(r.data.transactions||[])).catch(()=>{});
  }, []);

  const handleSubscribe = async (plan) => {
    if (plan === user?.plan) { toast("You're already on this plan"); return; }
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

  return (
    <div className="page pb-24">
      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-6 rounded-b-[2rem]">
        <h1 className="font-display text-2xl font-bold text-white mb-1">Plans & Credits</h1>
        <div className="flex items-center gap-2">
          <span className="text-kgreen-100 text-sm">Current plan:</span>
          <PlanBadge plan={user?.plan||"free"} />
          <span className="text-kgreen-100 text-sm ml-2">{(user?.credits||0).toLocaleString()} credits left</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-5 mt-4 flex bg-white rounded-2xl p-1 border border-gray-100 gap-1">
        {[["plans","📋 Subscription"],["credits","⚡ Top-up Credits"],["history","🧾 History"]].map(([key,lbl])=>(
          <button key={key} onClick={()=>setTab(key)}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition-all
              ${tab===key ? "bg-kgreen-700 text-white shadow-sm" : "text-gray-400"}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── PLANS TAB ── */}
      {tab === "plans" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {Object.entries(PLAN_INFO).map(([key, info]) => {
            const isCurrent = (user?.plan||"free") === key;
            const borderCls = isCurrent ? "border-2 border-kgreen-700" :
                              info.popular ? "border-2 border-kgold-500" : "border border-gray-100";
            return (
              <div key={key} className={`bg-white rounded-2xl p-4 ${borderCls}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-lg text-gray-900">{info.label}</span>
                      {info.popular && <span className="bg-kgold-100 text-kgold-700 text-xs font-bold px-2 py-0.5 rounded-full">Popular</span>}
                      {isCurrent && <span className="bg-kgreen-50 text-kgreen-700 text-xs font-bold px-2 py-0.5 rounded-full">Current</span>}
                    </div>
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
                {!isCurrent && key !== "free" && (
                  <button onClick={()=>handleSubscribe(key)} disabled={loading}
                    className={key==="pro" ? "btn-gold" : "btn-green"}>
                    {loading ? "⏳..." : "Upgrade to " + info.label}
                  </button>
                )}
                {isCurrent && (
                  <div className="bg-kgreen-50 rounded-xl p-3 text-center">
                    <p className="text-kgreen-700 text-sm font-semibold">✓ Your current plan</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREDITS TAB ── */}
      {tab === "credits" && (
        <div className="mx-5 mt-4">
          {/* Current balance */}
          <div className="bg-kgreen-700 rounded-2xl p-4 mb-4">
            <p className="text-kgreen-100 text-xs font-semibold uppercase tracking-wide mb-1">Available Credits</p>
            <p className="font-display text-4xl font-bold text-white">{(user?.credits||0).toLocaleString()}</p>
            <p className="text-kgreen-100 text-xs mt-1">broadcast sends · no expiry</p>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-1">Buy Credit Packs</p>
          <div className="grid grid-cols-2 gap-3">
            {CREDIT_PACKS.map(pack => (
              <button key={pack.key} onClick={()=>handleCredits(pack.key)} disabled={loading}
                className={`bg-white rounded-2xl p-4 text-left active:scale-95 transition-all
                            border ${pack.best ? "border-2 border-kgreen-700" : "border-gray-100"}`}>
                {pack.best && (
                  <span className="bg-kgreen-700 text-white text-xs font-bold px-2.5 py-0.5 rounded-full mb-2 inline-block">Best value</span>
                )}
                <p className="font-display font-bold text-xl text-gray-900">{pack.sends.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mb-2">sends</p>
                <p className="font-display font-bold text-kgreen-700 text-lg">{pack.price}</p>
                <p className="text-xs text-gray-400">{pack.tag}</p>
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            Pay via Paystack · Flutterwave · Bank Transfer
          </p>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
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
                              ${tx.status==="success" ? "bg-kgreen-50" : tx.status==="pending" ? "bg-amber-50" : "bg-red-50"}`}>
                <span className="text-lg">{tx.type==="credits" ? "⚡" : "💳"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm capitalize">
                  {tx.type==="credits" ? "Credits top-up" : "Subscription — " + tx.plan}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(tx.createdAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
                  {tx.credits > 0 && " · " + tx.credits + " sends"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900 text-sm">₦{(tx.amount/100).toLocaleString()}</p>
                <span className={`text-xs font-semibold ${tx.status==="success" ? "text-kgreen-700" : tx.status==="pending" ? "text-amber-600" : "text-red-500"}`}>
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
