import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const APP_URL = process.env.REACT_APP_URL || window.location.origin;

export default function ShopAgents() {
  const { user, refresh }           = useAuth();
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [generating, setGenerating] = useState(false);
  const [inviteUrl, setInviteUrl]   = useState("");
  const [commission, setCommission] = useState(user?.defaultCommission || 10);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [copied, setCopied]         = useState(false);
  const [tab, setTab]               = useState("agents");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/agents/shop-dashboard");
      setData(r.data);
      setCommission(r.data.commissionPct || 10);
    } catch (err) { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.post("/agents/shop-settings", {
        agentsEnabled: data?.agentsEnabled ?? true,
        defaultCommission: commission,
      });
      await refresh();
      toast.success("Settings saved!");
      fetchData();
    } catch (err) { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  const toggleAgents = async () => {
    try {
      await api.post("/agents/shop-settings", { agentsEnabled: !data?.agentsEnabled, defaultCommission: commission });
      await refresh();
      toast.success(!data?.agentsEnabled ? "Agents enabled! 🎉" : "Agents paused");
      fetchData();
    } catch (err) { toast.error("Failed"); }
  };

  const generateInvite = async () => {
    if (!data?.agentsEnabled) { toast.error("Enable agents first"); return; }
    setGenerating(true);
    try {
      const r = await api.post("/agents/generate-invite");
      setInviteUrl(r.data.inviteUrl);
      toast.success("Invite link generated!");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setGenerating(false); }
  };

  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); toast.success("Copied!"); setTimeout(() => setCopied(false), 2000); } catch (err) { toast.error("Copy failed"); }
  };

  const loadReport = async (agent) => {
    setSelectedAgent(agent);
    try {
      const r = await api.get("/agents/sales-report/" + agent._id);
      setReportData(r.data);
    } catch (err) { toast.error("Failed to load report"); }
  };

  const markPaid = async (saleIds) => {
    try {
      await api.post("/agents/mark-paid/" + selectedAgent._id, { saleIds });
      toast.success("Commission marked as paid! ✅");
      loadReport(selectedAgent);
      fetchData();
    } catch (err) { toast.error("Failed"); }
  };

  const removeAgent = async (agentShopId, name) => {
    if (!window.confirm("Remove " + name + " as agent?")) return;
    try {
      await api.post("/agents/remove/" + agentShopId);
      toast.success("Agent removed");
      setSelectedAgent(null);
      setReportData(null);
      fetchData();
    } catch (err) { toast.error("Failed"); }
  };

  if (loading) return (
    <div className="page items-center justify-center">
      <div className="text-center"><p className="text-4xl animate-bounce mb-3">🤝</p><p className="text-gray-400">Loading...</p></div>
    </div>
  );

  // Commission statement modal
  if (selectedAgent && reportData) return (
    <div className="page pb-24">
      <div className="bg-kgreen-700 px-5 pt-12 pb-6 rounded-b-[2rem]">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedAgent(null); setReportData(null); }}
            className="w-10 h-10 bg-kgreen-800 rounded-xl flex items-center justify-center text-white text-lg active:scale-95">←</button>
          <div>
            <h1 className="font-display text-xl font-bold text-white">Commission Statement</h1>
            <p className="text-kgreen-100 text-xs">{selectedAgent.agent?.name} · Code: {selectedAgent.agent?.agentCode}</p>
          </div>
        </div>
      </div>
      <div className="mx-5 mt-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="card text-center">
            <p className="font-display font-bold text-2xl text-kgreen-700">₦{(reportData.unpaidTotal || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">Unpaid commission</p>
          </div>
          <div className="card text-center">
            <p className="font-display font-bold text-2xl text-gray-400">₦{(reportData.paidTotal || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">Already paid</p>
          </div>
        </div>

        {/* Pay all unpaid */}
        {reportData.unpaidTotal > 0 && (
          <button onClick={() => {
            const unpaidIds = reportData.sales.filter(s => !s.paid).map(s => s._id);
            markPaid(unpaidIds);
          }} className="btn-green mb-4">
            ✅ Mark All Unpaid as Paid — ₦{(reportData.unpaidTotal || 0).toLocaleString()}
          </button>
        )}

        {/* Agent contact */}
        <div className="card mb-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-800">{selectedAgent.agent?.name}</p>
            <p className="text-xs text-gray-400">{selectedAgent.agent?.phone}</p>
          </div>
          <div className="flex gap-2">
            <a href={"https://wa.me/" + (selectedAgent.agent?.phone || "").replace(/[^\d+]/g,"")}
              target="_blank" rel="noreferrer"
              className="bg-green-500 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95">
              💬 WhatsApp
            </a>
            <button onClick={() => removeAgent(selectedAgent._id, selectedAgent.agent?.name)}
              className="bg-red-50 text-red-500 text-xs font-bold px-3 py-2 rounded-xl active:scale-95">
              Remove
            </button>
          </div>
        </div>

        {/* Sales list */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-1">Sales History</p>
        {reportData.sales?.length === 0 ? (
          <div className="text-center py-8"><p className="text-gray-400 text-sm">No sales recorded yet</p></div>
        ) : reportData.sales.map(sale => (
          <div key={sale._id} className="card flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sale.paid ? "bg-kgreen-50" : "bg-amber-50"}`}>
              <span style={{ fontSize:16 }}>{sale.paid ? "✅" : "⏳"}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">₦{(sale.saleAmount || 0).toLocaleString()} sale</p>
              <p className="text-xs text-gray-400">{new Date(sale.createdAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-kgold-700 text-sm">₦{(sale.commissionAmt || 0).toLocaleString()}</p>
              {!sale.paid && (
                <button onClick={() => markPaid([sale._id])}
                  className="text-xs text-kgreen-700 font-semibold mt-0.5">Mark paid</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page pb-24">
      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">My Agents</h1>
            <p className="text-kgreen-100 text-xs mt-0.5">{data?.agents?.length || 0} active agents</p>
          </div>
          <button onClick={toggleAgents}
            className={`text-xs font-bold px-3 py-2 rounded-xl active:scale-95 ${data?.agentsEnabled ? "bg-white text-kgreen-700" : "bg-kgold-500 text-kgold-700"}`}>
            {data?.agentsEnabled ? "✓ Agents On" : "Enable Agents"}
          </button>
        </div>
        <div className="flex bg-kgreen-800 rounded-2xl p-1 gap-1">
          {[["agents","🤝 Agents"],["settings","⚙️ Settings"],["invite","🔗 Invite"]].map(([key,lbl]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition-all
                ${tab===key ? "bg-kgold-500 text-kgold-700" : "text-kgreen-100"}`}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* AGENTS TAB */}
      {tab === "agents" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {!data?.agentsEnabled && (
            <div className="card bg-amber-50 border-amber-200 flex items-center gap-3 py-3">
              <span style={{ fontSize:20 }}>💡</span>
              <p className="text-xs text-amber-700 flex-1">Enable agents to let people sell your products and earn commission. Your sales grow, you pay nothing upfront.</p>
              <button onClick={toggleAgents} className="bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0">Enable</button>
            </div>
          )}

          {data?.agents?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🤝</p>
              <p className="font-semibold text-gray-500 mb-2">No agents yet</p>
              <p className="text-xs text-gray-400 mb-4">Generate an invite link and share it with people who can sell for you</p>
              <button onClick={() => setTab("invite")} className="btn-green">Generate Invite Link →</button>
            </div>
          ) : data.agents.map(agent => (
            <div key={agent._id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-kgreen-700 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-white text-sm">
                    {(agent.agent?.name || "A")[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800">{agent.agent?.name}</p>
                  <p className="text-xs text-gray-400">{agent.agent?.phone} · Code: {agent.agent?.agentCode}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge-green">{agent.commissionPct}%</span>
                    <span className="text-xs text-gray-400">{agent.totalSales || 0} sales</span>
                    {agent.unpaidEarnings > 0 && (
                      <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        ₦{(agent.unpaidEarnings || 0).toLocaleString()} unpaid
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-kgreen-700 text-sm">₦{(agent.totalEarned || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">total earned</p>
                </div>
              </div>
              <button onClick={() => loadReport(agent)}
                className="w-full bg-gray-50 text-gray-700 font-semibold text-sm py-2.5 rounded-xl active:scale-95 border border-gray-100">
                📊 View Commission Statement
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === "settings" && (
        <div className="mx-5 mt-4 flex flex-col gap-4">
          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Agent Commission</p>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Default commission for all agents</label>
                <span className="font-display font-bold text-2xl text-kgreen-700">{commission}%</span>
              </div>
              <input type="range" min="1" max="50" value={commission} step="1"
                onChange={e => setCommission(parseInt(e.target.value))}
                className="w-full"/>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1% min</span><span>50% max</span>
              </div>
            </div>

            {/* Commission calculator */}
            <div className="bg-kgreen-50 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-kgreen-700 mb-2">💡 What this means on a ₦10,000 sale</p>
              <div className="flex justify-between">
                <div className="text-center">
                  <p className="font-bold text-kgreen-700 text-lg">₦{Math.round(10000 * (commission/100)).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Agent earns</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-700 text-lg">₦{Math.round(10000 * (1 - commission/100)).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">You keep</p>
                </div>
              </div>
            </div>

            <button onClick={saveSettings} disabled={saving} className="btn-green">
              {saving ? "⏳ Saving..." : "Save Settings"}
            </button>
          </div>

          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">How agents get paid</p>
            <div className="flex flex-col gap-3">
              {[
                ["💰","You pay agents manually","After confirming sales, you see each agent's unpaid commission. Pay them via bank transfer, cash, or mobile money — however you normally pay people."],
                ["📊","Clear commission statements","Each agent has a statement showing every sale, the commission amount, and paid/unpaid status. No disputes, no confusion."],
                ["✅","You control when to pay","Mark commissions as paid once you have transferred the money. The agent sees their balance update immediately."],
              ].map(([icon, title, desc]) => (
                <div key={title} className="flex gap-3">
                  <span style={{ fontSize:18 }} className="flex-shrink-0">{icon}</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* INVITE TAB */}
      {tab === "invite" && (
        <div className="mx-5 mt-4 flex flex-col gap-4">
          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Generate Invite Link</p>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Share this link with anyone you want to become your agent. When they open it and accept, they are linked to your shop automatically and can start selling for you.
            </p>
            <button onClick={generateInvite} disabled={generating || !data?.agentsEnabled} className="btn-green mb-3">
              {generating ? "⏳ Generating..." : "🔗 Generate New Invite Link"}
            </button>
            {!data?.agentsEnabled && (
              <p className="text-xs text-amber-600 text-center">Enable agents first in the Settings tab</p>
            )}
          </div>

          {inviteUrl && (
            <div className="card bg-kgreen-50 border-kgreen-100">
              <p className="text-xs font-bold text-kgreen-700 uppercase tracking-wide mb-2">✅ Invite Link Ready</p>
              <p className="font-mono text-xs text-gray-500 bg-white rounded-xl px-3 py-2 mb-3 break-all border border-kgreen-100">
                {inviteUrl}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={copyInvite}
                  className="bg-white border-2 border-kgreen-700 text-kgreen-700 font-bold text-sm py-2.5 rounded-xl active:scale-95">
                  {copied ? "✓ Copied!" : "📋 Copy"}
                </button>
                <button onClick={() => navigator.share?.({ title:"Become my agent on Kustomer", url:inviteUrl }) || copyInvite()}
                  className="bg-kgreen-700 text-white font-bold text-sm py-2.5 rounded-xl active:scale-95">
                  📤 Share
                </button>
              </div>
              <p className="text-xs text-kgreen-600 mt-2 text-center">
                Commission: {data?.commissionPct || commission}% on every confirmed sale
              </p>
            </div>
          )}

          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Who should you invite?</p>
            {[
              ["👤","Trusted friends or family who know your products well"],
              ["🏪","Other market traders who have their own customer base"],
              ["📱","Social media influencers in your niche"],
              ["🤝","Church or mosque members who buy from you regularly"],
              ["🚗","Delivery riders, okada riders, transport workers"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-start gap-3 mb-2.5 last:mb-0">
                <span style={{ fontSize:16 }} className="flex-shrink-0">{icon}</span>
                <p className="text-sm text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
