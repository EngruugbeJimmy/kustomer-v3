import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";

const PLATFORM_INFO = {
  facebook:  { label:"Facebook",  icon:"📘", color:"#1877F2", bg:"#e8f0fe", tc:"#1253a0", desc:"Reach the largest Nigerian audience" },
  instagram: { label:"Instagram", icon:"📸", color:"#E1306C", bg:"#fce7f0", tc:"#9b1a3f", desc:"Visual content, stories, reels" },
  tiktok:    { label:"TikTok",    icon:"🎵", color:"#010101", bg:"#f0f0f0", tc:"#111",    desc:"Short videos — fastest growing" },
};

const BOOST_BUDGETS = [
  { naira:500,   days:1, label:"₦500",   sub:"1 day · ~500 reach" },
  { naira:1000,  days:2, label:"₦1,000", sub:"2 days · ~1,200 reach" },
  { naira:2500,  days:3, label:"₦2,500", sub:"3 days · ~3,500 reach" },
  { naira:5000,  days:5, label:"₦5,000", sub:"5 days · ~8,000 reach" },
  { naira:10000, days:7, label:"₦10,000",sub:"7 days · ~18,000 reach" },
];

function PageCard({ page, onDisconnect }) {
  const info = PLATFORM_INFO[page.platform] || {};
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
          style={{ background: info.bg }}>
          {page.profileImage
            ? <img src={page.profileImage} alt="" className="w-full h-full object-cover"/>
            : <div className="w-full h-full flex items-center justify-center text-2xl">{info.icon}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-gray-800">{page.pageName}</p>
            <span className="bg-kgreen-50 text-kgreen-700 text-xs font-bold px-2 py-0.5 rounded-full">✓ Connected</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{info.label} · {(page.followers || 0).toLocaleString()} followers</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label:"Posts",  value: page.totalPosts  || 0 },
          { label:"Boosts", value: page.totalBoosts || 0 },
          { label:"Spent",  value: "₦" + ((page.totalSpentOnBoosts || 0) / 1000).toFixed(1) + "K" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-2 text-center">
            <p className="font-bold text-gray-800 text-sm">{value}</p>
            <p className="text-gray-400 text-xs">{label}</p>
          </div>
        ))}
      </div>
      <button onClick={() => onDisconnect(page.platform)}
        className="text-xs text-gray-400 font-semibold w-full text-center py-1 active:text-red-500">
        Disconnect
      </button>
    </div>
  );
}

function BoostModal({ post, page, onClose, onBoost }) {
  const [budget, setBudget]     = useState(BOOST_BUDGETS[1]);
  const [location, setLocation] = useState("Nigeria");
  const [boosting, setBoosting] = useState(false);

  const handleBoost = async () => {
    setBoosting(true);
    try {
      await onBoost({
        postId:        post.id,
        platform:      page.platform,
        budgetNaira:   budget.naira,
        durationDays:  budget.days,
        targetLocation: location,
      });
      onClose();
    } finally { setBoosting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5"/>
        <h2 className="font-display text-xl font-bold mb-1">Boost this post</h2>
        <p className="text-sm text-gray-400 mb-5">Your post will be shown to more people in your target area</p>

        {/* Post preview */}
        <div className="bg-gray-50 rounded-2xl p-3 mb-5">
          <p className="text-sm text-gray-600 line-clamp-2">{post.message || "Your post"}</p>
        </div>

        {/* Budget selection */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Select budget</p>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {BOOST_BUDGETS.map(b => (
            <button key={b.naira} onClick={() => setBudget(b)}
              className={`flex items-center justify-between p-3 rounded-xl border-2 active:scale-[0.98] transition-all
                ${budget.naira === b.naira ? "border-kgreen-700 bg-kgreen-50" : "border-gray-100"}`}>
              <div>
                <p className="font-bold text-gray-800 text-sm">{b.label}</p>
                <p className="text-xs text-gray-400">{b.sub}</p>
              </div>
              {budget.naira === b.naira && (
                <div className="w-5 h-5 bg-kgreen-700 rounded-full flex items-center justify-center">
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Target location */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Target location</p>
        <select value={location} onChange={e => setLocation(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-5 focus:outline-none focus:border-kgreen-400">
          <option value="Nigeria">All Nigeria</option>
          <option value="Lagos">Lagos</option>
          <option value="Abuja">Abuja</option>
          <option value="Kano">Kano</option>
          <option value="Port Harcourt">Port Harcourt</option>
          <option value="Ibadan">Ibadan</option>
          <option value="Aba">Aba</option>
          <option value="Onitsha">Onitsha</option>
        </select>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-700">
            Payment is charged directly to your Facebook Ad Account in USD equivalent.
            Exchange rate: ~₦1,600 per $1. Your Facebook Ad Account must have sufficient balance.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95">
            Cancel
          </button>
          <button onClick={handleBoost} disabled={boosting}
            className="flex-1 py-3 bg-kgreen-700 text-white font-bold rounded-2xl active:scale-95 shadow-lg">
            {boosting ? "⏳ Starting..." : `Boost for ${budget.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SocialMedia() {
  const [sp]                    = useSearchParams();
  const [pages, setPages]       = useState([]);
  const [boosts, setBoosts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("pages");
  const [boostModal, setBoostModal] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, br] = await Promise.all([
        api.get("/social/pages"),
        api.get("/social/boosts"),
      ]);
      setPages(pr.data.pages || []);
      setBoosts(br.data.boosts || []);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false)); }
  }, []);

  useEffect(() => {
    const connected = sp.get("connected");
    const error     = sp.get("error");
    const setup     = sp.get("setup");
    if (connected) { toast.success(connected + " connected! 🎉"); fetchData(); }
    if (error && !setup) toast.error("Connection failed: " + error);
    if (setup) { toast("No Facebook Pages found — let's create one"); setTab("setup"); }
    fetchData();
  }, [fetchData]);

  const connectFacebook = async () => {
    setConnecting(true);
    try {
      const r = await api.get("/social/connect/facebook");
      window.location.href = r.data.url;
    } catch (err) { toast.error(err.response?.data?.error || "Connection failed"); setConnecting(false); }
  };

  const disconnectPage = async (platform) => {
    if (!window.confirm("Disconnect " + platform + "?")) return;
    try {
      await api.delete("/social/disconnect/" + platform);
      toast.success("Disconnected");
      fetchData();
    } catch { toast.error("Failed"); }
  };

  const handleBoost = async (params) => {
    try {
      const r = await api.post("/social/boost", params);
      toast.success(r.data.message);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error || "Boost failed"); }
  };

  const connectedPlatforms = pages.filter(p => p.status === "connected").map(p => p.platform);
  const hasFacebook   = connectedPlatforms.includes("facebook");
  const hasInstagram  = connectedPlatforms.includes("instagram");

  return (
    <div className="page pb-24">

      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <h1 className="font-display text-2xl font-bold text-white mb-1">Social Media</h1>
        <p className="text-kgreen-100 text-sm">Connect, post, and boost — all from one place</p>

        {/* Connected platforms row */}
        <div className="flex gap-2 mt-3">
          {Object.entries(PLATFORM_INFO).map(([key, info]) => {
            const connected = connectedPlatforms.includes(key);
            return (
              <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${connected ? "bg-white" : "bg-kgreen-800"}`}>
                <span style={{ fontSize:14 }}>{info.icon}</span>
                <span className={`text-xs font-semibold ${connected ? "text-gray-700" : "text-kgreen-100"}`}>
                  {connected ? "✓ " : ""}{info.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-5 mt-4 flex bg-white rounded-2xl p-1 border border-gray-100 gap-1">
        {[["pages","📱 Pages"],["boost","🚀 Boost"],["setup","⚙️ Setup"]].map(([key,lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition-all
              ${tab === key ? "bg-kgreen-700 text-white" : "text-gray-400"}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* PAGES TAB */}
      {tab === "pages" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {loading ? (
            <div className="text-center py-8"><p className="text-gray-400">Loading...</p></div>
          ) : pages.filter(p => p.status === "connected").length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-5xl mb-3">📱</p>
              <p className="font-bold text-gray-700 text-lg mb-2">No pages connected yet</p>
              <p className="text-sm text-gray-400 mb-5">Connect your Facebook and Instagram to post automatically and run paid boosts</p>
              <button onClick={connectFacebook} disabled={connecting}
                className="btn-green">
                {connecting ? "⏳ Connecting..." : "Connect Facebook & Instagram"}
              </button>
            </div>
          ) : (
            <>
              {pages.filter(p => p.status === "connected").map(page => (
                <PageCard key={page._id} page={page} onDisconnect={disconnectPage}/>
              ))}
              {!hasFacebook && (
                <button onClick={connectFacebook} disabled={connecting} className="btn-green">
                  {connecting ? "⏳..." : "Connect Facebook & Instagram"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* BOOST TAB */}
      {tab === "boost" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {!hasFacebook ? (
            <div className="card text-center py-8">
              <p className="text-4xl mb-3">🚀</p>
              <p className="font-bold text-gray-700 mb-2">Connect Facebook first</p>
              <p className="text-sm text-gray-400 mb-4">Boosting requires a connected Facebook Page with an active Ad Account</p>
              <button onClick={() => setTab("pages")} className="btn-green">Connect Facebook →</button>
            </div>
          ) : (
            <>
              <div className="card bg-kgreen-50 border-kgreen-100">
                <p className="text-xs font-bold text-kgreen-700 uppercase tracking-wide mb-2">How boosting works</p>
                <div className="flex flex-col gap-2">
                  {[
                    ["📤","Post content from AI Agent or Marketing tab"],
                    ["🚀","Tap Boost on any post that is performing well"],
                    ["🎯","Set your budget and target city in Nigeria"],
                    ["👁","Meta shows your post to thousands of new people"],
                    ["🛒","They click your catalog link and order on WhatsApp"],
                  ].map(([icon, text]) => (
                    <div key={text} className="flex items-start gap-2">
                      <span style={{ fontSize:14 }}>{icon}</span>
                      <p className="text-xs text-kgreen-700">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active boosts */}
              {boosts.length > 0 && (
                <>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Your boosts</p>
                  {boosts.slice(0,5).map(boost => (
                    <div key={boost._id} className="card">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize:16 }}>{PLATFORM_INFO[boost.platform]?.icon}</span>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">₦{(boost.budgetNaira || 0).toLocaleString()} boost</p>
                            <p className="text-xs text-gray-400">{boost.durationDays} days · {boost.targetLocation}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize
                          ${boost.status === "active" ? "bg-kgreen-50 text-kgreen-700" :
                            boost.status === "completed" ? "bg-blue-50 text-blue-700" :
                            "bg-gray-100 text-gray-500"}`}>
                          {boost.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label:"Reach",  value: (boost.reach  || 0).toLocaleString() },
                          { label:"Clicks", value: (boost.clicks || 0).toLocaleString() },
                          { label:"Orders", value: boost.orders || 0 },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50 rounded-xl p-2 text-center">
                            <p className="font-bold text-gray-800 text-sm">{value}</p>
                            <p className="text-gray-400 text-xs">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}

              <div className="card bg-amber-50 border-amber-100 py-3">
                <p className="text-xs text-amber-700 leading-relaxed">
                  To boost a specific post, go to AI Agent → approve your daily content → then come back here to boost. Boosts are charged to your Facebook Ad Account directly — not to Kustomer credits.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* SETUP TAB */}
      {tab === "setup" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          <div className="card">
            <p className="text-sm font-bold text-gray-700 mb-4">Set up your social presence</p>

            {/* Facebook + Instagram */}
            <div className="flex flex-col gap-3 mb-4">
              <div className={`flex items-center gap-3 p-3 rounded-xl border-2 ${hasFacebook ? "border-kgreen-700 bg-kgreen-50" : "border-gray-100"}`}>
                <span style={{ fontSize:24 }}>📘</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">Facebook Page + Instagram</p>
                  <p className="text-xs text-gray-400">Connecting Facebook automatically links Instagram too</p>
                </div>
                {hasFacebook
                  ? <span className="text-kgreen-700 font-bold text-sm">✓ Done</span>
                  : <button onClick={connectFacebook} disabled={connecting}
                      className="bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95">
                      Connect
                    </button>}
              </div>

              {/* TikTok — coming soon */}
              <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-100 opacity-60">
                <span style={{ fontSize:24 }}>🎵</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-700 text-sm">TikTok</p>
                  <p className="text-xs text-gray-400">Auto-posting coming soon — captions ready now</p>
                </div>
                <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2.5 py-1 rounded-full">Soon</span>
              </div>
            </div>

            {/* No page guide */}
            {!hasFacebook && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-blue-700 mb-2">No Facebook Page yet? Here is how to create one:</p>
                <div className="flex flex-col gap-2">
                  {[
                    "Open Facebook on your phone",
                    "Tap Menu → Pages → Create",
                    "Name it your shop name e.g. Mama Ngozi Store",
                    "Choose Business or Brand as category",
                    "Add your shop description and WhatsApp number",
                    "Come back here and tap Connect",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                      <p className="text-xs text-blue-700">{step}</p>
                    </div>
                  ))}
                </div>
                <button onClick={connectFacebook} disabled={connecting}
                  className="w-full mt-3 py-3 bg-blue-500 text-white font-bold text-sm rounded-xl active:scale-95">
                  {connecting ? "⏳ Connecting..." : "I created my page — Connect now"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {boostModal && (
        <BoostModal
          post={boostModal.post}
          page={boostModal.page}
          onClose={() => setBoostModal(null)}
          onBoost={handleBoost}
        />
      )}
    </div>
  );
}
