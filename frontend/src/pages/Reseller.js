import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const APP_URL = process.env.REACT_APP_URL || window.location.origin;

export default function Reseller() {
  const { user }              = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    api.get("/reseller/me")
      .then(r => setData(r.data))
      .catch(() => toast.error("Failed to load reseller data"))
      .finally(() => setLoading(false));
  }, []);

  const referralUrl = data?.resellerCode ? APP_URL + "/signup?ref=" + data.resellerCode : "";

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(referralUrl); setCopied(true); toast.success("Referral link copied!"); setTimeout(()=>setCopied(false),2000); } catch (err) { toast.error("Copy failed"); }
  };

  if (loading) return (
    <div className="page items-center justify-center">
      <div className="text-center"><p className="text-4xl mb-3 animate-bounce">🤝</p><p className="text-gray-400">Loading reseller data...</p></div>
    </div>
  );

  return (
    <div className="page pb-24">
      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-6 rounded-b-[2rem]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-kgold-500 rounded-2xl flex items-center justify-center">
            <span className="text-2xl">🤝</span>
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">Reseller Dashboard</h1>
            <p className="text-kgreen-100 text-xs">Earn 30% on every shop you refer</p>
          </div>
        </div>
        {/* Your code */}
        <div className="bg-kgreen-800 rounded-2xl p-3">
          <p className="text-kgreen-100 text-xs font-semibold uppercase tracking-wide mb-1">Your Referral Code</p>
          <p className="text-kgold-500 font-display font-bold text-3xl tracking-widest">{data?.resellerCode || "—"}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-5 mt-4 grid grid-cols-3 gap-2">
        {[
          { label:"Shops Referred", value:(data?.totalShops||0),              color:"text-kgreen-700" },
          { label:"Total Earned",   value:"₦"+(data?.totalEarnings||0)/100,   color:"text-kgold-700" },
          { label:"Pending Payout", value:"₦"+(data?.pendingPayout||0)/100,   color:"text-purple-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-3 text-center border border-gray-100">
            <p className={`font-display font-bold text-xl ${color}`}>{value}</p>
            <p className="text-gray-400 text-[10px] mt-0.5 font-medium leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="mx-5 mt-4 bg-white rounded-2xl p-4 border border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">How it works</p>
        {[
          { n:"1", text:"Share your referral link with shop owners" },
          { n:"2", text:"They sign up using your link or code" },
          { n:"3", text:"When they subscribe to any paid plan..." },
          { n:"4", text:"You earn 30% commission — paid monthly!" },
        ].map(({ n, text }) => (
          <div key={n} className="flex items-start gap-3 mb-3 last:mb-0">
            <div className="w-6 h-6 bg-kgreen-700 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">{n}</span>
            </div>
            <p className="text-sm text-gray-600">{text}</p>
          </div>
        ))}
      </div>

      {/* Share referral link */}
      <div className="mx-5 mt-4 bg-kgold-50 border border-kgold-100 rounded-2xl p-4">
        <p className="text-xs font-bold text-kgold-700 uppercase tracking-wide mb-2">Your Referral Link</p>
        <p className="text-xs text-gray-500 font-mono bg-white rounded-xl px-3 py-2 mb-3 break-all border border-kgold-100">
          {referralUrl}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copyLink}
            className="bg-white border-2 border-kgold-300 text-kgold-700 font-semibold text-sm py-2.5 rounded-xl active:scale-95 transition-all">
            {copied ? "✓ Copied!" : "📋 Copy Link"}
          </button>
          <button onClick={()=>{ if(navigator.share) navigator.share({title:"Join Kustomer",url:referralUrl}); else copyLink(); }}
            className="bg-kgold-500 text-kgold-700 font-semibold text-sm py-2.5 rounded-xl active:scale-95 shadow-md">
            📤 Share Link
          </button>
        </div>
      </div>

      {/* Recent sales */}
      {data?.sales?.length > 0 && (
        <div className="mx-5 mt-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-1">Recent Referrals</p>
          <div className="flex flex-col gap-2">
            {data.sales.map((s,i) => (
              <div key={i} className="card flex items-center gap-3 py-3">
                <div className="w-9 h-9 bg-kgreen-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-kgreen-700 text-sm">{s.shopName?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{s.shopName}</p>
                  <p className="text-xs text-gray-400 capitalize">{s.plan} plan · {new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-kgreen-700 text-sm">+₦{(s.commission/100).toLocaleString()}</p>
                  <span className={`text-xs font-semibold ${s.paid ? "text-kgreen-600" : "text-amber-600"}`}>
                    {s.paid ? "Paid" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
