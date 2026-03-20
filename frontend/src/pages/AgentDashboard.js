import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const APP_URL = process.env.REACT_APP_URL || window.location.origin;

export default function AgentDashboard() {
  const { user, refresh }             = useAuth();
  const navigate                      = useNavigate();
  const [data, setData]               = useState(null);
  const [sales, setSales]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activating, setActivating]   = useState(false);
  const [tab, setTab]                 = useState("shops");
  const [copied, setCopied]           = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dr, sr] = await Promise.all([
        api.get("/agents/my-dashboard"),
        api.get("/agents/my-sales"),
      ]);
      setData(dr.data);
      setSales(sr.data.sales || []);
    } catch (err) {
      if (err.response?.status === 400) {
        // Not yet an agent — show activation screen
        setData(null);
      } else {
        toast.error("Failed to load");
      }
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activateAgent = async () => {
    setActivating(true);
    try {
      await api.post("/agents/become-agent", { bio: "" });
      await refresh();
      toast.success("Agent account activated! 🎉");
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setActivating(false); }
  };

  const copyLink = async (url, key) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      toast.success("Link copied!");
      setTimeout(() => setCopied(""), 2000);
    } catch { toast.error("Copy failed"); }
  };

  const shareLink = (url, shopName) => {
    if (navigator.share) {
      navigator.share({ title: "Shop " + shopName + " on Kustomer", url });
    } else {
      copyLink(url, shopName);
    }
  };

  if (loading) return (
    <div className="page items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-3 animate-bounce">🤝</p>
        <p className="text-gray-400">Loading agent dashboard...</p>
      </div>
    </div>
  );

  // Not yet an agent — activation screen
  if (!user?.isAgent || !data) return (
    <div className="page pb-24">
      <div className="bg-kgreen-700 px-5 pt-12 pb-6 rounded-b-[2rem]">
        <h1 className="font-display text-2xl font-bold text-white mb-1">Agent Program</h1>
        <p className="text-kgreen-100 text-sm">Sell for shops and earn commission on every sale</p>
      </div>
      <div className="mx-5 mt-5">
        <div className="card text-center py-8 mb-4">
          <p className="text-5xl mb-4">🤝</p>
          <h2 className="font-display font-bold text-xl text-gray-800 mb-2">Become a Kustomer Agent</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Link up with shops, share their products with your network, and earn a commission on every confirmed sale. No upfront cost. No stock to hold. Just sell.
          </p>
          <button onClick={activateAgent} disabled={activating} className="btn-green">
            {activating ? "⏳ Activating..." : "🤝 Activate Agent Account — Free"}
          </button>
        </div>
        <div className="card mb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">How it works</p>
          {[
            ["1️⃣", "Activate your free agent account"],
            ["2️⃣", "Browse shops and request to be their agent — or join via invite link from a shop owner"],
            ["3️⃣", "Get your unique tracked link for each shop"],
            ["4️⃣", "Share the link on WhatsApp, social media, anywhere"],
            ["5️⃣", "When someone orders through your link, the sale is recorded automatically"],
            ["6️⃣", "Shop owner confirms the sale — your commission appears in your dashboard"],
            ["7️⃣", "Shop owner pays your commission monthly via bank transfer or cash"],
          ].map(([n, text]) => (
            <div key={n} className="flex items-start gap-3 mb-3 last:mb-0">
              <span style={{ fontSize:16 }}>{n}</span>
              <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
        <div className="card bg-kgold-50 border-kgold-100">
          <p className="text-xs font-bold text-kgold-700 uppercase tracking-wide mb-2">Example earnings</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Mama Ngozi Store gives agents 10% commission. You share their catalog link with 200 WhatsApp contacts. 20 people order rice at ₦8,500 each. Total sales = ₦170,000. Your commission = <span className="font-bold text-kgreen-700">₦17,000</span> for sharing one link.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page pb-24">
      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-kgold-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-2xl">🤝</span>
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">Agent Dashboard</h1>
            <p className="text-kgreen-100 text-xs">Code: <span className="font-bold text-kgold-300">{data?.agentCode}</span></p>
          </div>
        </div>

        {/* Earnings summary */}
        <div className="bg-kgreen-800 rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label:"Total earned",   value:"₦" + (data?.totalEarned || 0).toLocaleString(),  color:"text-kgold-300" },
              { label:"Total paid",     value:"₦" + (data?.totalPaid   || 0).toLocaleString(),  color:"text-white" },
              { label:"Unpaid balance", value:"₦" + (data?.unpaidTotal || 0).toLocaleString(),  color:"text-green-300" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={`font-display font-bold text-lg ${color}`}>{value}</p>
                <p className="text-kgreen-100 text-[9px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-5 mt-4 flex bg-white rounded-2xl p-1 border border-gray-100 gap-1">
        {[["shops","🏪 My Shops"],["sales","💰 My Sales"],["discover","🔍 Find Shops"]].map(([key,lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition-all
              ${tab === key ? "bg-kgreen-700 text-white shadow-sm" : "text-gray-400"}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* MY SHOPS */}
      {tab === "shops" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {/* Pending invites */}
          {data?.pendingInvites?.length > 0 && (
            <div className="card bg-amber-50 border-amber-200">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">⏳ Pending Invites</p>
              {data.pendingInvites.map(inv => (
                <div key={inv._id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{inv.shop?.name}</p>
                    <p className="text-xs text-gray-400">{inv.commissionPct}% commission</p>
                  </div>
                  <button onClick={async () => {
                    await api.post("/agents/join-shop", { inviteCode: inv.inviteCode, agentId: user._id });
                    fetchData(); toast.success("Joined!");
                  }} className="bg-kgreen-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                    Accept
                  </button>
                </div>
              ))}
            </div>
          )}

          {data?.shops?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🏪</p>
              <p className="font-semibold text-gray-500 mb-2">No shops yet</p>
              <p className="text-xs text-gray-400 mb-4">Get an invite link from a shop owner or browse shops accepting agents</p>
              <button onClick={() => setTab("discover")} className="btn-green">Browse Shops →</button>
            </div>
          ) : data.shops.map(shopLink => {
            const trackedUrl = APP_URL + "/shop/" + shopLink.shopSlug + "?agent=" + data.agentCode;
            return (
              <div key={shopLink._id} className="card">
                {/* Shop header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-kgreen-700 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-white text-sm">
                      {(shopLink.shopName || "S")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800">{shopLink.shopName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="badge-green">{shopLink.commissionPct}% commission</span>
                      <span className="text-xs text-gray-400">{shopLink.totalSales || 0} sales</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-kgreen-700 text-sm">₦{(shopLink.totalEarned || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">earned</p>
                  </div>
                </div>

                {/* Unpaid notice */}
                {shopLink.unpaidEarnings > 0 && (
                  <div className="bg-amber-50 rounded-xl p-2 mb-3 flex items-center justify-between">
                    <p className="text-xs text-amber-700 font-semibold">
                      ₦{(shopLink.unpaidEarnings || 0).toLocaleString()} unpaid commission
                    </p>
                    <p className="text-xs text-amber-600">Awaiting payment from shop</p>
                  </div>
                )}

                {/* Tracked link */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Your tracked link</p>
                  <p className="font-mono text-xs text-gray-500 break-all mb-2">{trackedUrl}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => copyLink(trackedUrl, shopLink._id)}
                      className="bg-white border border-gray-200 text-gray-700 font-bold text-xs py-2 rounded-xl active:scale-95">
                      {copied === shopLink._id ? "✓ Copied!" : "📋 Copy"}
                    </button>
                    <button onClick={() => shareLink(trackedUrl, shopLink.shopName)}
                      className="bg-kgreen-700 text-white font-bold text-xs py-2 rounded-xl active:scale-95">
                      📤 Share
                    </button>
                  </div>
                </div>

                {/* Recent sales */}
                {shopLink.recentSales?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Recent sales</p>
                    {shopLink.recentSales.slice(0,3).map(s => (
                      <div key={s._id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <p className="text-xs text-gray-600">₦{(s.saleAmount || 0).toLocaleString()} sale</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-kgreen-700">+₦{(s.commissionAmt || 0).toLocaleString()}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.paid ? "bg-kgreen-50 text-kgreen-700" : "bg-amber-50 text-amber-700"}`}>
                            {s.paid ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MY SALES */}
      {tab === "sales" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {sales.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">💰</p>
              <p className="font-semibold text-gray-500">No sales yet</p>
              <p className="text-xs text-gray-400 mt-1">Share your tracked links to start earning</p>
            </div>
          ) : sales.map(sale => (
            <div key={sale._id} className="card flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sale.paid ? "bg-kgreen-50" : "bg-amber-50"}`}>
                <span style={{ fontSize:18 }}>{sale.paid ? "✅" : "⏳"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm">{sale.shop?.name || "Shop"}</p>
                <p className="text-xs text-gray-400">
                  ₦{(sale.saleAmount || 0).toLocaleString()} sale · {sale.commissionPct}% commission ·{" "}
                  {new Date(sale.createdAt).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-kgreen-700">+₦{(sale.commissionAmt || 0).toLocaleString()}</p>
                <span className={`text-xs font-semibold ${sale.paid ? "text-kgreen-700" : "text-amber-600"}`}>
                  {sale.paid ? "Paid" : "Unpaid"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DISCOVER SHOPS */}
      {tab === "discover" && <DiscoverShops agentCode={data?.agentCode} onJoined={fetchData}/>}
    </div>
  );
}

function DiscoverShops({ agentCode, onJoined }) {
  const { user }                = useAuth();
  const [shops, setShops]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [joining, setJoining]   = useState(null);

  useEffect(() => {
    api.get("/agents/discover").then(r => setShops(r.data.shops || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const requestToJoin = async (shopSlug) => {
    setJoining(shopSlug);
    try {
      // Generate a self-invite — agent requests to join the shop
      const res = await api.post("/agents/request-join", { shopSlug, agentId: user._id });
      toast.success("Request sent to shop owner!");
      onJoined();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setJoining(null); }
  };

  if (loading) return <div className="text-center py-8"><p className="text-gray-400">Loading shops...</p></div>;

  return (
    <div className="mx-5 mt-0 flex flex-col gap-3">
      <div className="card bg-kgreen-50 border-kgreen-100 py-3">
        <p className="text-xs text-kgreen-700 leading-relaxed">
          These shops are actively looking for agents. Tap "Become Agent" to send a request. Once the shop owner approves you, your tracked link appears on your dashboard.
        </p>
      </div>
      {shops.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-4xl mb-3">🏪</p>
          <p className="text-gray-400 text-sm">No shops currently recruiting agents</p>
        </div>
      ) : shops.map(shop => (
        <div key={shop._id} className="card flex items-center gap-3">
          <div className="w-12 h-12 bg-kgreen-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-white">{shop.name[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-sm">{shop.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{shop.shopDescription}</p>
            <span className="badge-gold mt-1 inline-block">{shop.defaultCommission || 10}% commission</span>
          </div>
          <button onClick={() => requestToJoin(shop.shopSlug)} disabled={joining === shop.shopSlug}
            className="bg-kgreen-700 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 flex-shrink-0">
            {joining === shop.shopSlug ? "⏳" : "Join"}
          </button>
        </div>
      ))}
    </div>
  );
}
