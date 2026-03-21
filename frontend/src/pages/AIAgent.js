import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../utils/api";

const PLATFORM_CONFIG = {
  waMessage:  { label:"WhatsApp Broadcast", icon:"💬", color:"#dcfce7", tc:"#166534" },
  waStatus:   { label:"WhatsApp Status",    icon:"🟢", color:"#dcfce7", tc:"#166534" },
  facebook:   { label:"Facebook",           icon:"📘", color:"#dbeafe", tc:"#1e40af" },
  instagram:  { label:"Instagram",          icon:"📸", color:"#fce7f3", tc:"#9d174d" },
  tiktok:     { label:"TikTok",             icon:"🎵", color:"#f3e8ff", tc:"#6b21a8" },
};

function BriefingCard({ briefing, onApprove, onSkip, onRegenerate, onEdit, loading }) {
  const [editing, setEditing]   = useState(null); // which platform is being edited
  const [edits, setEdits]       = useState({});
  const isApproved = briefing?.status === "approved";
  const isSkipped  = briefing?.status === "skipped";

  const handleEdit = (key, value) => setEdits(prev => ({ ...prev, [key]: value }));

  const saveEdit = async () => {
    await onEdit(edits);
    setEditing(null);
    toast.success("Saved!");
  };

  if (!briefing) return (
    <div className="card text-center py-10">
      <p className="text-4xl mb-3 animate-pulse">✨</p>
      <p className="font-semibold text-gray-600">Generating today's content...</p>
      <p className="text-xs text-gray-400 mt-1">AI is studying your shop data</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* AI Reasoning */}
      {briefing.aiReasoning && (
        <div className="bg-kgreen-50 border border-kgreen-100 rounded-2xl p-4">
          <p className="text-xs font-bold text-kgreen-700 uppercase tracking-wide mb-1">🤖 Why AI chose this today</p>
          <p className="text-sm text-kgreen-800 leading-relaxed">{briefing.aiReasoning}</p>
        </div>
      )}

      {/* Product being promoted */}
      {briefing.productName && (
        <div className="card flex items-center gap-3 py-3">
          <div className="w-10 h-10 bg-kgold-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <span style={{ fontSize:20 }}>📦</span>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Featured product today</p>
            <p className="font-semibold text-gray-800">{briefing.productName}</p>
          </div>
        </div>
      )}

      {/* Content cards per platform */}
      {Object.entries(PLATFORM_CONFIG).map(([key, config]) => {
        const content = edits[key] ?? briefing[key];
        if (!content) return null;
        const isEditing = editing === key;
        return (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50"
              style={{ background: config.color }}>
              <span style={{ fontSize:16 }}>{config.icon}</span>
              <p className="font-bold text-sm flex-1" style={{ color: config.tc }}>{config.label}</p>
              {!isApproved && !isSkipped && (
                <button onClick={() => setEditing(isEditing ? null : key)}
                  className="text-xs font-semibold active:scale-95" style={{ color: config.tc }}>
                  {isEditing ? "Cancel" : "Edit"}
                </button>
              )}
            </div>
            <div className="px-4 py-3">
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={edits[key] ?? content}
                    onChange={e => handleEdit(key, e.target.value)}
                    rows={4}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:border-kgreen-400"
                  />
                  <button onClick={saveEdit} className="bg-kgreen-700 text-white text-xs font-bold py-2 rounded-xl active:scale-95">
                    Save edit
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>
              )}
            </div>
          </div>
        );
      })}

      {/* Action buttons */}
      {!isApproved && !isSkipped && (
        <div className="flex flex-col gap-2 mt-1">
          <button onClick={onApprove} disabled={loading}
            className="w-full py-4 bg-kgreen-700 text-white font-bold text-base rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-kgreen-900/20">
            {loading ? "⏳ Approving..." : "✅ Approve and send all platforms"}
          </button>
          <div className="flex gap-2">
            <button onClick={onRegenerate} disabled={loading}
              className="flex-1 py-3 bg-gray-100 text-gray-600 font-semibold text-sm rounded-xl active:scale-95">
              🔄 Regenerate
            </button>
            <button onClick={onSkip} disabled={loading}
              className="flex-1 py-3 bg-gray-100 text-gray-500 font-semibold text-sm rounded-xl active:scale-95">
              Skip today
            </button>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="bg-kgreen-50 border border-kgreen-100 rounded-2xl p-4 text-center">
          <p className="text-2xl mb-1">✅</p>
          <p className="font-bold text-kgreen-700">Approved and ready to send</p>
          <p className="text-xs text-kgreen-600 mt-1">Go to Marketing to send your WhatsApp broadcast. Social captions are ready to copy.</p>
        </div>
      )}

      {isSkipped && (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
          <p className="text-sm text-gray-500">Skipped for today. See you tomorrow.</p>
        </div>
      )}
    </div>
  );
}

function FollowUpCard({ followUp, onMarkSent }) {
  const [sent, setSent] = useState(followUp.sent);
  const customer        = followUp.customer;

  const handleSend = async () => {
    const phone = (customer?.phone || "").replace(/[^\d+]/g, "");
    const msg   = encodeURIComponent(followUp.message);
    window.open("https://wa.me/" + phone + "?text=" + msg, "_blank");
    // Mark as sent
    try {
      await onMarkSent(followUp._id);
      setSent(true);
    } catch (err) {}
  };

  return (
    <div className={`card ${sent ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-kgreen-700 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="font-bold text-white text-sm">
            {(customer?.name || "?")[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-800 text-sm">{customer?.name}</p>
          <p className="text-xs text-gray-400">{customer?.phone}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          customer?.buyerTag === "hot" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
        }`}>
          {customer?.buyerTag === "hot" ? "🔥 Hot" : "👁 Clicker"}
        </span>
      </div>
      <div className="bg-gray-50 rounded-xl p-3 mb-3">
        <p className="text-sm text-gray-700 leading-relaxed">{followUp.message}</p>
      </div>
      {!sent ? (
        <button onClick={handleSend}
          className="w-full py-2.5 bg-green-500 text-white font-bold text-sm rounded-xl active:scale-95">
          💬 Send on WhatsApp
        </button>
      ) : (
        <div className="text-center py-2 text-xs text-gray-400 font-semibold">✓ Sent</div>
      )}
    </div>
  );
}

export default function AIAgent() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(false);
  const [tab, setTab]           = useState("briefing");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/agent/today");
      setData(r.data);
    } catch (err) { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async () => {
    if (!data?.briefing?._id) return;
    setActing(true);
    try {
      await api.post("/agent/briefing/" + data.briefing._id + "/approve");
      toast.success("Approved! 🎉 Content ready to send.");
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setActing(false); }
  };

  const handleSkip = async () => {
    if (!data?.briefing?._id) return;
    try {
      await api.post("/agent/briefing/" + data.briefing._id + "/skip");
      toast("Skipped for today");
      fetchData();
    } catch (err) { toast.error("Failed"); }
  };

  const handleRegenerate = async () => {
    if (!data?.briefing?._id) return;
    setActing(true);
    toast("Regenerating...", { duration: 4000 });
    try {
      await api.post("/agent/briefing/" + data.briefing._id + "/regenerate");
      toast.success("Fresh content generated!");
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setActing(false); }
  };

  const handleEdit = async (edits) => {
    if (!data?.briefing?._id) return;
    try {
      await api.patch("/agent/briefing/" + data.briefing._id, edits);
      fetchData();
    } catch (err) { toast.error("Save failed"); }
  };

  const handleMarkSent = async (id) => {
    await api.post("/agent/follow-up/" + id + "/sent");
  };

  const handleGenerateFollowUps = async () => {
    setActing(true);
    toast("Finding today's clickers...", { duration: 4000 });
    try {
      const r = await api.post("/agent/follow-ups/generate");
      toast.success(r.data.count + " follow-ups generated!");
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setActing(false); }
  };

  const today = new Date().toLocaleDateString("en-NG", { weekday:"long", day:"numeric", month:"long" });

  return (
    <div className="page pb-24">

      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-kgold-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">AI Agent</h1>
            <p className="text-kgreen-100 text-xs">{today}</p>
          </div>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label:"Briefing", value: data?.briefing?.status || "–", color: data?.briefing?.status === "approved" ? "text-kgold-300" : "text-white" },
            { label:"Follow-ups", value: (data?.followUps?.length || 0) + " ready", color:"text-white" },
            { label:"History", value: (data?.history?.length || 0) + " days", color:"text-white" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-kgreen-800 rounded-xl p-2.5 text-center">
              <p className={`font-bold text-sm ${color} capitalize`}>{value}</p>
              <p className="text-kgreen-100 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-5 mt-4 flex bg-white rounded-2xl p-1 border border-gray-100 gap-1">
        {[
          ["briefing","🤖 Today's content"],
          ["followups","📩 Follow-ups"],
          ["history","📊 History"],
        ].map(([key,lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition-all
              ${tab === key ? "bg-kgreen-700 text-white" : "text-gray-400"}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* BRIEFING TAB */}
      {tab === "briefing" && (
        <div className="mx-5 mt-4">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3 animate-spin inline-block">✨</p>
              <p className="text-gray-400 font-medium">Generating today's content...</p>
            </div>
          ) : (
            <BriefingCard
              briefing={data?.briefing}
              onApprove={handleApprove}
              onSkip={handleSkip}
              onRegenerate={handleRegenerate}
              onEdit={handleEdit}
              loading={acting}
            />
          )}
        </div>
      )}

      {/* FOLLOW-UPS TAB */}
      {tab === "followups" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          <div className="card bg-purple-50 border-purple-100 py-3">
            <p className="text-xs text-purple-700 leading-relaxed">
              These customers viewed your catalog today but did not order. AI wrote personalised messages for each one. Tap Send to open WhatsApp pre-filled with their message.
            </p>
          </div>

          {!data?.followUps?.length ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">📩</p>
              <p className="font-semibold text-gray-500 mb-2">No follow-ups yet</p>
              <p className="text-xs text-gray-400 mb-4">Follow-ups generate automatically at 6pm, or tap below to run now</p>
              <button onClick={handleGenerateFollowUps} disabled={acting}
                className="btn-green">
                {acting ? "⏳ Generating..." : "Generate follow-ups now"}
              </button>
            </div>
          ) : (
            <>
              {data.followUps.map(fu => (
                <FollowUpCard key={fu._id} followUp={fu} onMarkSent={handleMarkSent}/>
              ))}
              <div className="text-center">
                <button onClick={handleGenerateFollowUps} disabled={acting}
                  className="text-sm text-kgreen-700 font-semibold">
                  Refresh follow-ups
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {!data?.history?.length ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-gray-400">No briefing history yet</p>
            </div>
          ) : data.history.map(b => (
            <div key={b._id} className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-800 text-sm">
                  {new Date(b.date).toLocaleDateString("en-NG", { weekday:"short", day:"numeric", month:"short" })}
                </p>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize
                  ${b.status === "approved" ? "bg-kgreen-50 text-kgreen-700" :
                    b.status === "sent"     ? "bg-blue-50 text-blue-700" :
                    b.status === "skipped"  ? "bg-gray-100 text-gray-500" :
                    "bg-amber-50 text-amber-700"}`}>
                  {b.status}
                </span>
              </div>
              {b.productName && <p className="text-xs text-gray-400">Featured: {b.productName}</p>}
              {b.waRecipients > 0 && <p className="text-xs text-kgreen-700 mt-1">Sent to {b.waRecipients} customers</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
