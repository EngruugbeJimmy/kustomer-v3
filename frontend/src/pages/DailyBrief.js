import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";

const PLATFORM_CONFIG = {
  waMessage:  { label:"WhatsApp Broadcast", icon:"💬", color:"#25d366", light:"#dcfce7", tc:"#166534" },
  waStatus:   { label:"WhatsApp Status",    icon:"🟢", color:"#25d366", light:"#dcfce7", tc:"#166534" },
  facebook:   { label:"Facebook",           icon:"📘", color:"#1877f2", light:"#e8f0fe", tc:"#1253a0" },
  instagram:  { label:"Instagram",          icon:"📸", color:"#e1306c", light:"#fce7f0", tc:"#9b1a3f" },
  tiktok:     { label:"TikTok",             icon:"🎵", color:"#010101", light:"#f5f5f5", tc:"#111111" },
};

export default function DailyBrief() {
  const navigate              = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving]   = useState(false);
  const [edits, setEdits]     = useState({});
  const [editing, setEditing] = useState(null); // which platform is being edited
  const [tab, setTab]         = useState("today");

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/agent/brief/today");
      setData(r.data);
    } catch (err) { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const r = await api.post("/agent/brief/generate");
      toast.success(r.data.existing ? "Brief already ready!" : "Brief generated! ✨");
      fetchToday();
    } catch (err) {
      toast.error(err.response?.data?.error || "Generation failed");
    } finally { setGenerating(false); }
  };

  const handleApprove = async () => {
    if (!data?.brief) return;
    setApproving(true);
    try {
      const hasEdits = Object.keys(edits).length > 0;
      await api.post("/agent/brief/approve", {
        briefId: data.brief._id,
        edits: hasEdits ? edits : undefined,
      });
      toast.success("Approved! Content is ready to send 🚀");
      fetchToday();
    } catch (err) {
      toast.error(err.response?.data?.error || "Approval failed");
    } finally { setApproving(false); }
  };

  const handleSkip = async () => {
    if (!data?.brief) return;
    try {
      await api.post("/agent/brief/skip", { briefId: data.brief._id });
      toast("Skipped today's brief");
      fetchToday();
    } catch (err) { toast.error("Failed"); }
  };

  const getContent = (key) => edits[key] !== undefined ? edits[key] : data?.brief?.[key] || "";

  const startEdit = (key) => setEditing(key);
  const saveEdit  = (key, val) => { setEdits(prev => ({ ...prev, [key]: val })); setEditing(null); };

  const brief  = data?.brief;
  const status = brief?.status;

  if (loading) return (
    <div className="page items-center justify-center">
      <div className="text-center">
        <p className="text-5xl mb-3 animate-pulse">🤖</p>
        <p className="text-gray-400">Loading your AI brief...</p>
      </div>
    </div>
  );

  return (
    <div className="page pb-24">
      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-kgold-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">AI Agent</h1>
            <p className="text-kgreen-100 text-xs">
              {status === "draft"    && "Today's brief is ready for approval"}
              {status === "approved" && "Brief approved — ready to send"}
              {status === "sent"     && "Today's content has been sent"}
              {status === "skipped"  && "You skipped today"}
              {!brief               && "No brief yet — generate one below"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-kgreen-800 rounded-2xl p-1 gap-1">
          {[["today","📋 Today"],["history","📅 History"],["settings","⚙️ Settings"]].map(([key,lbl]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition-all
                ${tab === key ? "bg-kgold-500 text-kgold-900" : "text-kgreen-100"}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* TODAY TAB */}
      {tab === "today" && (
        <div className="mx-5 mt-4 flex flex-col gap-4">

          {/* Stats strip */}
          {data?.stats && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label:"Customers", value:data.stats.customerCount, color:"text-kgreen-700" },
                { label:"Hot buyers", value:data.stats.hotCount,     color:"text-amber-600" },
                { label:"Buyers",    value:data.stats.buyerCount,    color:"text-blue-600"  },
                { label:"Clickers",  value:data.stats.clickerCount,  color:"text-purple-600"},
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-2xl p-3 text-center border border-gray-100">
                  <p className={`font-display font-bold text-xl ${color}`}>{value}</p>
                  <p className="text-gray-400 text-[9px] mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* No brief yet */}
          {!brief && (
            <div className="card text-center py-8">
              <p className="text-5xl mb-4">🤖</p>
              <p className="font-display font-bold text-xl text-gray-800 mb-2">No brief yet today</p>
              <p className="text-sm text-gray-400 mb-1">
                {data?.hasApiKey
                  ? "AI generates briefs automatically at 7am. Tap below to generate now."
                  : "Add your ANTHROPIC_API_KEY to enable AI brief generation."}
              </p>
              {data?.hasApiKey && (
                <>
                  <p className="text-xs text-gray-300 mb-5">Uses 5 credits</p>
                  <button onClick={handleGenerate} disabled={generating} className="btn-green">
                    {generating ? "✨ Generating..." : "✨ Generate Today's Brief"}
                  </button>
                </>
              )}
              {!data?.hasApiKey && (
                <div className="bg-amber-50 rounded-xl p-3 mt-4 text-xs text-amber-700">
                  Add ANTHROPIC_API_KEY in your Render environment variables to enable this feature.
                </div>
              )}
            </div>
          )}

          {/* Brief exists */}
          {brief && (
            <>
              {/* Insight */}
              <div className="bg-kgreen-50 border border-kgreen-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-kgreen-700 uppercase tracking-wide mb-1">🧠 Why AI picked this</p>
                <p className="text-sm text-kgreen-800 leading-relaxed">{brief.insight}</p>
                <p className="text-xs text-kgreen-600 mt-2 font-semibold">
                  Featured product: {brief.productName}
                </p>
              </div>

              {/* Status banner */}
              {status === "approved" && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
                  <span style={{ fontSize:24 }}>✅</span>
                  <div>
                    <p className="font-bold text-blue-700 text-sm">Approved and ready</p>
                    <p className="text-xs text-blue-500">Go to Marketing to send the WhatsApp broadcast. Copy social captions below.</p>
                  </div>
                </div>
              )}
              {status === "sent" && (
                <div className="bg-kgreen-50 border border-kgreen-100 rounded-2xl p-4 flex items-center gap-3">
                  <span style={{ fontSize:24 }}>🚀</span>
                  <div>
                    <p className="font-bold text-kgreen-700 text-sm">Today's content sent</p>
                    <p className="text-xs text-kgreen-600">Come back tomorrow for a fresh brief.</p>
                  </div>
                </div>
              )}

              {/* Content cards */}
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">
                {status === "draft" ? "Review and edit before approving" : "Today's content"}
              </p>

              {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => {
                const content = getContent(key);
                if (!content) return null;
                const isEditing = editing === key;

                return (
                  <div key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    {/* Platform header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50"
                      style={{ background: cfg.light }}>
                      <span style={{ fontSize:18 }}>{cfg.icon}</span>
                      <p className="font-bold text-sm flex-1" style={{ color:cfg.tc }}>{cfg.label}</p>
                      {status === "draft" && !isEditing && (
                        <button onClick={() => startEdit(key)}
                          className="text-xs font-semibold px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-500 active:scale-95">
                          Edit
                        </button>
                      )}
                    </div>

                    {/* Content */}
                    <div className="px-4 py-3">
                      {isEditing ? (
                        <div>
                          <textarea
                            defaultValue={content}
                            rows={4}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:border-kgreen-400 mb-2"
                            id={`edit-${key}`}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => setEditing(null)}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 active:scale-95">
                              Cancel
                            </button>
                            <button onClick={() => {
                              const val = document.getElementById(`edit-${key}`)?.value || content;
                              saveEdit(key, val);
                            }} className="flex-1 py-2 rounded-xl text-xs font-bold bg-kgreen-700 text-white active:scale-95">
                              Save edit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>
                      )}
                    </div>

                    {/* Copy button for approved/sent */}
                    {(status === "approved" || status === "sent") && (
                      <div className="px-4 pb-3">
                        <button onClick={async () => {
                          await navigator.clipboard.writeText(content);
                          toast.success("Copied!");
                        }} className="w-full py-2.5 rounded-xl text-sm font-bold bg-gray-50 border border-gray-100 text-gray-700 active:scale-95">
                          📋 Copy {cfg.label} caption
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Clicker follow-up */}
              {brief.clickerFollowUp && (
                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">
                    🎯 6pm Clicker Follow-up ({brief.clickerCount} customers)
                  </p>
                  <p className="text-sm text-purple-800 leading-relaxed">{brief.clickerFollowUp}</p>
                  <p className="text-xs text-purple-500 mt-2">
                    {brief.clickerFollowUpSentAt
                      ? "✓ Queued for sending at 6pm"
                      : "Will be sent automatically at 6pm Lagos time"}
                  </p>
                </div>
              )}

              {/* Approve / Skip buttons — only for draft */}
              {status === "draft" && (
                <div className="flex flex-col gap-3">
                  <button onClick={handleApprove} disabled={approving}
                    className="btn-green py-4 text-base font-bold flex items-center justify-center gap-2">
                    {approving ? "⏳ Approving..." : "✅ Approve and Send All"}
                  </button>
                  <button onClick={handleGenerate} disabled={generating}
                    className="bg-gray-50 border border-gray-200 text-gray-600 font-semibold py-3 rounded-2xl text-sm active:scale-95">
                    {generating ? "✨ Regenerating..." : "🔄 Regenerate brief"}
                  </button>
                  <button onClick={handleSkip}
                    className="text-center text-sm text-gray-300 font-medium py-2">
                    Skip today →
                  </button>
                </div>
              )}

              {/* After approval — go send */}
              {status === "approved" && (
                <button onClick={() => navigate("/marketing")}
                  className="btn-green py-4 text-base font-bold">
                  📣 Go to Marketing to send WhatsApp broadcast →
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && <BriefHistory />}

      {/* SETTINGS TAB */}
      {tab === "settings" && <AgentSettings />}
    </div>
  );
}

function BriefHistory() {
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/agent/brief/history")
      .then(r => setBriefs(r.data.briefs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const STATUS_STYLE = {
    draft:    "bg-amber-50 text-amber-700",
    approved: "bg-blue-50 text-blue-700",
    sent:     "bg-kgreen-50 text-kgreen-700",
    skipped:  "bg-gray-100 text-gray-500",
  };

  if (loading) return <div className="text-center py-12"><p className="text-gray-400">Loading...</p></div>;

  return (
    <div className="mx-5 mt-4 flex flex-col gap-3">
      {briefs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-400 text-sm">No brief history yet</p>
        </div>
      ) : briefs.map(brief => (
        <div key={brief._id} className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold text-gray-800 text-sm">{brief.date}</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[brief.status]}`}>
              {brief.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-2">Featured: {brief.productName}</p>
          <p className="text-xs text-gray-500 italic leading-relaxed">{brief.insight}</p>
          {brief.clickerCount > 0 && (
            <p className="text-xs text-purple-600 mt-2">🎯 {brief.clickerCount} clicker follow-ups sent</p>
          )}
        </div>
      ))}
    </div>
  );
}

function AgentSettings() {
  return (
    <div className="mx-5 mt-4 flex flex-col gap-4">
      <div className="card">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Daily schedule</p>
        {[
          ["🤖 Brief generation",    "7:00 AM Lagos time", "AI studies your shop and drafts all content"],
          ["📋 Approval notification","7:30 AM",           "You get a notification to review and approve"],
          ["🎯 Clicker follow-ups",   "6:00 PM Lagos time","AI sends follow-ups to today's non-buyers"],
        ].map(([title, time, desc]) => (
          <div key={title} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm">{title}</p>
              <p className="text-xs text-kgreen-700 font-semibold">{time}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="card bg-kgreen-50 border-kgreen-100">
        <p className="text-xs font-bold text-kgreen-700 uppercase tracking-wide mb-2">Credit usage</p>
        <p className="text-xs text-kgreen-700 leading-relaxed">
          Brief generation costs 5 credits. Clicker follow-ups cost 1 credit per customer contacted. You are only charged when you approve — not when the brief is generated.
        </p>
      </div>
    </div>
  );
}
