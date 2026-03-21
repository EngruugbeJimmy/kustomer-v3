import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import PlanBadge from "../components/PlanBadge";

const APP_URL = process.env.REACT_APP_URL || window.location.origin;
const PLAN_COLOR = { free:"bg-gray-400", starter:"bg-kgreen-700", pro:"bg-kgold-500" };
const PLAN_CREDITS = { free:30, starter:500, pro:2000 };


// Verification banner — shown at top of Home if phone not verified
function VerifyBanner({ user, navigate }) {
  if (user?.phoneVerified) return null;
  return (
    <div
      onClick={() => navigate("/verify-phone")}
      className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-all">
      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <span style={{fontSize:18}}>📱</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-amber-800 text-sm">Verify your phone number</p>
        <p className="text-xs text-amber-600 mt-0.5">Required to broadcast, use agents and appear in Discover</p>
      </div>
      <span className="text-amber-400 text-lg flex-shrink-0">›</span>
    </div>
  );
}

export default function Home() {
  const { user, logout, refresh } = useAuth();
  const navigate                  = useNavigate();
  const [stats, setStats]         = useState({ customers:0, products:0, messages:0 });
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [copied, setCopied]       = useState(false);

  const catalogUrl = APP_URL + "/shop/" + user?.shopSlug;
  const planMax    = PLAN_CREDITS[user?.plan||"free"];
  const creditPct  = Math.min(100, Math.round(((user?.credits||0)/planMax)*100));
  const lowCredits = (user?.credits||0) < 50;

  useEffect(() => {
    (async () => {
      try {
        const [cc, pc, mh] = await Promise.all([
          api.get("/customers/count"),
          api.get("/products"),
          api.get("/messages"),
        ]);
        setStats({ customers: cc.data.count, products: pc.data.products.length, messages: mh.data.messages.length });
        setHistory(mh.data.messages.slice(0,3) || []);
      } catch (err) {}
      finally { setLoading(false); }
    })();
  }, []);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(catalogUrl); setCopied(true); toast.success("Link copied!"); setTimeout(()=>setCopied(false),2000); } catch (err) { toast.error("Copy failed"); }
  };
  const shareLink = () => navigator.share ? navigator.share({ title: user?.name + " on Kustomer", url: catalogUrl }) : copyLink();

  const firstName = user?.name?.split(" ")[0] || "there";

  const QUICK = [
    { icon:"📦", label:"Products",   action:()=>navigate("/products"),            bg:"bg-kgreen-50",  tc:"text-kgreen-700" },
    { icon:"📢", label:"Broadcast",  action:()=>navigate("/marketing"),           bg:"bg-kgold-50",   tc:"text-kgold-700" },
    { icon:"👥", label:"Customers",  action:()=>navigate("/customers"),           bg:"bg-blue-50",    tc:"text-blue-700" },
    { icon:"🛒", label:"My Shop",    action:()=>window.open("/shop/"+user?.shopSlug,"_blank"), bg:"bg-purple-50", tc:"text-purple-700" },
    { icon:"💳", label:"Plans",      action:()=>navigate("/billing"),             bg:"bg-kgreen-50",  tc:"text-kgreen-700" },
    { icon:"🤝", label:"Reseller",   action:()=>navigate("/reseller"),            bg:"bg-kgold-50",   tc:"text-kgold-700" },
    { icon:"📊", label:"History",    action:()=>navigate("/marketing?tab=history"), bg:"bg-gray-100",  tc:"text-gray-600" },
    { icon:"⚙️",  label:"Settings",  action:()=>navigate("/settings"),           bg:"bg-gray-100",   tc:"text-gray-600" },
  ];

  return (
    <div className="page pb-24">
      {/* ── OPay-style green header ── */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-6 rounded-b-[2rem]">
        {/* Top row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-kgold-500 flex items-center justify-center shadow-lg">
              <span className="text-xl font-display font-bold text-kgold-700">
                {firstName[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-kgreen-100 text-xs font-medium">Good day 👋</p>
              <p className="text-white font-display font-bold text-base leading-tight">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PlanBadge plan={user?.plan||"free"} />
            <button onClick={()=>{logout();navigate("/login");}}
              className="bg-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-xl active:bg-white/25">
              Logout
            </button>
          </div>
        </div>

        {/* Credits balance card */}
        <div className="bg-kgreen-800 rounded-2xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-kgreen-100 text-xs font-medium uppercase tracking-wide mb-1">Broadcast Credits</p>
              <p className="text-white font-display font-bold text-4xl tracking-tight">
                {loading ? "—" : (user?.credits||0).toLocaleString()}
              </p>
              <p className="text-kgreen-100 text-xs mt-1">sends remaining</p>
            </div>
            <button onClick={()=>navigate("/billing")}
              className="bg-kgold-500 text-kgold-700 text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-all">
              Top Up
            </button>
          </div>
          {/* Credit bar */}
          <div className="bg-kgreen-900 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${creditPct > 30 ? "bg-kgold-500" : "bg-red-400"}`}
                 style={{ width: creditPct + "%" }} />
          </div>
          <p className="text-kgreen-100 text-xs mt-1.5">{creditPct}% remaining this period</p>
        </div>
      </div>

      {/* Low credits warning */}
      {lowCredits && (
        <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-800">Running low on credits</p>
            <p className="text-xs text-amber-600">Only {user?.credits} sends left · Top up now</p>
          </div>
          <button onClick={()=>navigate("/billing")}
            className="bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95">
            Top Up
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="mx-5 mt-4 grid grid-cols-3 gap-2">
        {[
          { label:"Customers", value: stats.customers, color:"text-kgreen-700" },
          { label:"Products",  value: stats.products,  color:"text-kgold-700" },
          { label:"Broadcasts",value: stats.messages,  color:"text-purple-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-3 text-center border border-gray-100">
            <p className={`font-display font-bold text-2xl ${color}`}>{loading ? "—" : value}</p>
            <p className="text-gray-400 text-xs mt-0.5 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions 2x4 grid */}
      <div className="mx-5 mt-4 bg-white rounded-2xl p-4 border border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Quick Actions</p>
        <div className="grid grid-cols-4 gap-3">
          {QUICK.map(({ icon, label, action, bg, tc }) => (
            <button key={label} onClick={action}
              className="flex flex-col items-center gap-1.5 active:scale-90 transition-all">
              <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center shadow-sm`}>
                <span className="text-2xl">{icon}</span>
              </div>
              <span className={`text-[10px] font-semibold ${tc} text-center leading-tight`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Catalog link share */}
      <div className="mx-5 mt-4 bg-kgreen-700 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🔗</span>
          <span className="text-kgreen-100 text-xs font-semibold uppercase tracking-wide">Your Shop Link</span>
        </div>
        <p className="text-white/70 text-xs font-mono bg-kgreen-800 rounded-xl px-3 py-2 mb-3 break-all">
          {catalogUrl}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copyLink}
            className="bg-white/15 text-white text-sm font-semibold py-2.5 rounded-xl active:scale-95 transition-all">
            {copied ? "✓ Copied!" : "📋 Copy"}
          </button>
          <button onClick={shareLink}
            className="bg-kgold-500 text-kgold-700 text-sm font-semibold py-2.5 rounded-xl active:scale-95 transition-all">
            📤 Share
          </button>
        </div>
        <p className="text-kgreen-100 text-xs mt-2 text-center">
          Include in broadcasts so customers can view & order
        </p>
      </div>

      {/* Recent activity */}
      {history.length > 0 && (
        <div className="mx-5 mt-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">Recent Broadcasts</p>
          <div className="flex flex-col gap-2">
            {history.map(msg => (
              <div key={msg._id} className="card flex gap-3 items-start py-3">
                <div className="w-8 h-8 bg-kgreen-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-base">📨</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 line-clamp-1">{msg.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {msg.recipientCount} recipients · {msg.creditsUsed} credits ·{" "}
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
