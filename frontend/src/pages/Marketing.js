import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";
import { CHANNELS, TEMPLATES, buildBroadcastMessage, broadcastMessages } from "../utils/whatsapp";
import { useAuth } from "../context/AuthContext";

const APP_URL = process.env.REACT_APP_URL || window.location.origin;

const PLAN_ORDER = { free:0, starter:1, pro:2, business:3 };

export default function Marketing() {
  const { user, refresh }               = useAuth();
  const navigate                        = useNavigate();
  const [channel, setChannel]           = useState("whatsapp");
  const [message, setMessage]           = useState("");
  const [subject, setSubject]           = useState("");
  const [customers, setCustomers]       = useState([]);
  const [selected, setSelected]         = useState(new Set());
  const [selectAll, setSelectAll]       = useState(false);
  const [includeLink, setIncludeLink]   = useState(true);
  const [sending, setSending]           = useState(false);
  const [progress, setProgress]         = useState({ current:0, total:0 });
  const [aiLoading, setAiLoading]       = useState(false);
  const [generatedPost, setGeneratedPost] = useState("");
  const [history, setHistory]           = useState([]);
  const [tab, setTab]                   = useState("compose");
  const [loading, setLoading]           = useState(true);
  const [products, setProducts]         = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");

  const catalogUrl = APP_URL + "/shop/" + user?.shopSlug;
  const userPlanLevel = PLAN_ORDER[user?.plan || "free"];
  const currentChannel = CHANNELS.find(c => c.id === channel);
  const channelLocked = PLAN_ORDER[currentChannel?.plan || "free"] > userPlanLevel;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, hr, pr] = await Promise.all([
        api.get("/customers"),
        api.get("/marketing/history"),
        api.get("/products"),
      ]);
      setCustomers(cr.data.customers);
      setHistory(hr.data.campaigns || []);
      setProducts(pr.data.products || []);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSelected(selectAll ? new Set(customers.map(c => c._id)) : new Set()); }, [selectAll, customers]);

  const toggle = id => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Generate AI social post
  const generatePost = async () => {
    if (!message.trim() && !selectedProduct) { toast.error("Enter a message or select a product first"); return; }
    setAiLoading(true);
    setGeneratedPost("");
    try {
      const res = await api.post("/marketing/social-post", {
        channel,
        productId: selectedProduct || undefined,
        customMessage: message.trim() || undefined,
      });
      setGeneratedPost(res.data.text);
      toast.success("AI post generated! ✨");
    } catch (err) { toast.error(err.response?.data?.error || "Generation failed"); }
    finally { setAiLoading(false); }
  };

  const copyPost = async () => {
    await navigator.clipboard.writeText(generatedPost);
    toast.success("Copied to clipboard!");
  };

  // Send based on channel
  const handleSend = async () => {
    if (channelLocked) { navigate("/billing"); return; }
    const recipientList = customers.filter(c => selected.has(c._id));

    if (channel === "whatsapp") {
      if (!message.trim()) { toast.error("Write a message first"); return; }
      if (!recipientList.length) { toast.error("Select customers"); return; }
      if ((user?.credits || 0) < recipientList.length) { toast.error("Not enough credits"); navigate("/billing"); return; }
      const finalMsg = includeLink ? buildBroadcastMessage(message, catalogUrl) : message;
      setSending(true); setProgress({ current:0, total:recipientList.length });
      try {
        await broadcastMessages(recipientList, finalMsg, (c,t) => setProgress({ current:c, total:t }));
        await api.post("/marketing/whatsapp", { message:finalMsg, recipients:recipientList.map(r=>({name:r.name,phone:r.phone})), includeLink });
        await refresh();
        toast.success("Sent to " + recipientList.length + " customers! 🎉");
        await fetchData();
        setMessage(""); setSelected(new Set()); setSelectAll(false);
      } catch { toast.error("Something went wrong"); }
      finally { setSending(false); setProgress({ current:0, total:0 }); }

    } else if (channel === "status") {
      // WhatsApp Status — opens WhatsApp Web/App for user to post manually
      const statusText = includeLink ? buildBroadcastMessage(message, catalogUrl) : message;
      window.open("https://wa.me/?text=" + encodeURIComponent(statusText), "_blank");
      await api.post("/marketing/whatsapp", { message:statusText, recipients:[], includeLink });
      toast.success("WhatsApp opened — post as your Status! 🟢");

    } else if (channel === "sms") {
      if (!message.trim()) { toast.error("Write a message first"); return; }
      if (!recipientList.length) { toast.error("Select customers"); return; }
      setSending(true);
      try {
        const res = await api.post("/marketing/sms", { message:message.trim(), recipients:recipientList.map(r=>({name:r.name,phone:r.phone})) });
        toast.success("SMS sent to " + res.data.sent + " customers! 📱");
        await fetchData(); setMessage(""); setSelected(new Set());
      } catch (err) { toast.error(err.response?.data?.error || "SMS failed"); }
      finally { setSending(false); }

    } else if (channel === "email") {
      if (!subject.trim() || !message.trim()) { toast.error("Subject and message required"); return; }
      if (!recipientList.length) { toast.error("Select customers"); return; }
      const emailCustomers = recipientList.filter(c => c.email);
      if (!emailCustomers.length) { toast.error("No selected customers have email addresses"); return; }
      setSending(true);
      try {
        const res = await api.post("/marketing/email", { subject:subject.trim(), message:message.trim(), recipients:emailCustomers.map(r=>({name:r.name,email:r.email})) });
        toast.success("Emails sent to " + res.data.sent + " customers! 📧");
        await fetchData(); setMessage(""); setSubject(""); setSelected(new Set());
      } catch (err) { toast.error(err.response?.data?.error || "Email failed"); }
      finally { setSending(false); }
    }
  };

  const isSocialAI = ["tiktok","facebook","instagram"].includes(channel);
  const needsRecipients = ["whatsapp","sms","email"].includes(channel);
  const credits = user?.credits || 0;

  const CHANNEL_HINT = {
    whatsapp:  "Opens WhatsApp for each customer with message pre-filled",
    status:    "Opens WhatsApp so you can post as your Status — all contacts see it",
    sms:       "Sends SMS directly — reaches customers without WhatsApp data",
    email:     "Sends email via Resend — requires customers to have email saved",
    tiktok:    "AI writes your TikTok caption — copy and post it yourself",
    facebook:  "AI writes your Facebook post — copy and post it yourself",
    instagram: "AI writes your Instagram caption with hashtags — copy and post",
  };

  return (
    <div className="page pb-28">
      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Marketing</h1>
            <p className="text-kgreen-100 text-xs mt-0.5">{credits} WA credits · {user?.smsCredits||0} SMS · {user?.emailCredits||0} email</p>
          </div>
          <button onClick={() => navigate("/billing")} className="bg-kgold-500 text-kgold-700 text-xs font-bold px-3 py-2 rounded-xl">Top Up</button>
        </div>
        {/* Tabs */}
        <div className="flex bg-kgreen-800 rounded-2xl p-1 gap-1">
          {[["compose","✏️ Compose"],["history","📋 History"]].map(([key,lbl]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all
                ${tab===key ? "bg-kgold-500 text-kgold-700" : "text-kgreen-100"}`}>{lbl}</button>
          ))}
        </div>
      </div>

      {tab === "compose" && (
        <div className="mx-5 mt-4 flex flex-col gap-4">

          {/* Channel picker */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Choose Channel</p>
            <div className="grid grid-cols-4 gap-2">
              {CHANNELS.map(ch => {
                const locked = PLAN_ORDER[ch.plan] > userPlanLevel;
                const active = channel === ch.id;
                return (
                  <button key={ch.id}
                    onClick={() => { setChannel(ch.id); setGeneratedPost(""); setMessage(""); }}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all active:scale-95
                      ${active ? "border-kgreen-700 bg-kgreen-50" : "border-gray-100 bg-white"}
                      ${locked ? "opacity-60" : ""}`}>
                    <div className={`w-9 h-9 rounded-xl ${ch.color} flex items-center justify-center`}>
                      <span className="text-xl">{locked ? "🔒" : ch.icon}</span>
                    </div>
                    <span className={`text-[9px] font-bold leading-tight text-center ${active ? ch.tc : "text-gray-500"}`}>{ch.label}</span>
                    {locked && <span className="text-[8px] text-gray-400 capitalize">{ch.plan}+</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center italic">{CHANNEL_HINT[channel]}</p>
          </div>

          {/* Locked channel upgrade prompt */}
          {channelLocked && (
            <div className="card bg-amber-50 border-amber-200 flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div className="flex-1">
                <p className="font-bold text-amber-800 text-sm">{currentChannel?.label} requires {currentChannel?.plan} plan</p>
                <p className="text-xs text-amber-600 mt-0.5">Upgrade to unlock SMS, Email, TikTok, Facebook & Instagram</p>
              </div>
              <button onClick={() => navigate("/billing")} className="bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-xl">Upgrade</button>
            </div>
          )}

          {/* AI Social channels */}
          {isSocialAI && !channelLocked && (
            <>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Select Product (optional)</p>
                <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="input py-3">
                  <option value="">General shop promotion</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name} — {p.currency}{Number(p.price).toLocaleString()}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Or describe what to post</p>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
                  placeholder="e.g. We have fresh bread and 20% discount today..."
                  className="input resize-none" maxLength={300}/>
              </div>
              <button onClick={generatePost} disabled={aiLoading}
                className="btn-gold flex items-center justify-center gap-2">
                {aiLoading ? "✨ Generating..." : `✨ Generate ${currentChannel?.label} Post with AI`}
              </button>
              {generatedPost && (
                <div className="card border-kgreen-100 bg-kgreen-50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-kgreen-700 uppercase tracking-wide">Generated {currentChannel?.label} Post</p>
                    <button onClick={copyPost} className="bg-kgreen-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95">📋 Copy</button>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{generatedPost}</p>
                  <p className="text-xs text-gray-400 mt-3 italic">Copy this text → open {currentChannel?.label} → paste and post</p>
                </div>
              )}
            </>
          )}

          {/* WhatsApp Status */}
          {channel === "status" && !channelLocked && (
            <>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Status Message</p>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  placeholder="What do you want your contacts to see?" className="input resize-none" maxLength={700}/>
                <p className="text-xs text-gray-300 text-right mt-1">{message.length}/700</p>
              </div>
              <div className="card flex items-center justify-between py-3">
                <div><p className="font-semibold text-gray-700 text-sm">📎 Include shop link</p><p className="text-xs text-gray-400">Viewers tap to browse your catalog</p></div>
                <button onClick={() => setIncludeLink(!includeLink)}
                  className={`w-12 h-6 rounded-full transition-colors ${includeLink ? "bg-kgreen-700" : "bg-gray-200"}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${includeLink ? "translate-x-6" : "translate-x-0.5"}`}/>
                </button>
              </div>
              {message.trim() && (
                <div className="card bg-green-50 border-green-100">
                  <p className="text-xs font-bold text-green-700 mb-2">🟢 Status Preview</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{includeLink ? buildBroadcastMessage(message, catalogUrl) : message}</p>
                </div>
              )}
              <button onClick={handleSend} disabled={!message.trim()} className="btn-green flex items-center justify-center gap-2">
                <span className="text-xl">🟢</span> Post to WhatsApp Status
              </button>
            </>
          )}

          {/* WhatsApp broadcast */}
          {channel === "whatsapp" && !channelLocked && (
            <>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Quick Templates</p>
                <div className="flex flex-col gap-2">
                  {TEMPLATES.map((t,i) => (
                    <button key={i} onClick={() => setMessage(t.text)} className="card text-left flex items-center gap-3 active:bg-kgreen-50 transition-all">
                      <span className="text-xl">{t.emoji}</span><span className="font-medium text-gray-700 text-sm">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Message</p>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Type your message..." className="input resize-none" maxLength={800}/>
              </div>
              <div className="card flex items-center justify-between py-3">
                <div><p className="font-semibold text-gray-700 text-sm">📎 Include shop link</p><p className="text-xs text-gray-400">Customers tap to view & order</p></div>
                <button onClick={() => setIncludeLink(!includeLink)}
                  className={`w-12 h-6 rounded-full transition-colors ${includeLink ? "bg-kgreen-700" : "bg-gray-200"}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${includeLink ? "translate-x-6" : "translate-x-0.5"}`}/>
                </button>
              </div>
            </>
          )}

          {/* SMS */}
          {channel === "sms" && !channelLocked && (
            <>
              <div className="card bg-blue-50 border-blue-100 flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <div><p className="font-bold text-blue-800 text-sm">SMS Credits: {user?.smsCredits||0}</p>
                <p className="text-xs text-blue-600">Each SMS = 1 credit</p></div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">SMS Message (max 160 chars)</p>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Short message — keep under 160 chars for 1 SMS" className="input resize-none" maxLength={160}/>
                <p className="text-xs text-gray-300 text-right mt-1">{message.length}/160</p>
              </div>
            </>
          )}

          {/* Email */}
          {channel === "email" && !channelLocked && (
            <>
              <div className="card bg-purple-50 border-purple-100 flex items-center gap-3">
                <span className="text-2xl">📧</span>
                <div><p className="font-bold text-purple-800 text-sm">Email Credits: {user?.emailCredits||0}</p>
                <p className="text-xs text-purple-600">Each email = 1 credit. Customers need email saved.</p></div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Subject Line</p>
                <input type="text" placeholder="e.g. Special offer from Mama Ngozi Store!" value={subject} onChange={e => setSubject(e.target.value)} className="input" maxLength={100}/>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Email Body</p>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Write your email message..." className="input resize-none" maxLength={2000}/>
              </div>
            </>
          )}

          {/* Recipients for direct channels */}
          {needsRecipients && !channelLocked && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  Recipients{selected.size > 0 && <span className="bg-kgreen-700 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2">{selected.size}</span>}
                </p>
                <button onClick={() => setSelectAll(!selectAll)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${selectAll ? "bg-kgreen-700 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {selectAll ? "✓ All" : "Select all"}
                </button>
              </div>
              {loading ? <p className="text-gray-400 text-sm text-center py-4">Loading...</p> :
              customers.length === 0 ? (
                <div className="card text-center py-5"><p className="text-gray-400 text-sm">No customers yet.</p>
                  <a href="/customers" className="text-kgreen-700 font-semibold text-sm mt-1 block">Add customers →</a></div>
              ) : (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                  {customers.map(c => {
                    const sel = selected.has(c._id);
                    return (
                      <button key={c._id} onClick={() => toggle(c._id)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all active:scale-98
                          ${sel ? "border-kgreen-700 bg-kgreen-50" : "border-gray-100 bg-white"}`}>
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${sel ? "border-kgreen-700 bg-kgreen-700" : "border-gray-200"}`}>
                          {sel && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{c.name}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {c.phone}
                            {channel === "email" && (c.email ? " · " + c.email : " · no email ⚠️")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Send button for direct channels */}
          {needsRecipients && !channelLocked && !isSocialAI && (
            sending ? (
              <div className="card text-center py-5">
                <p className="text-3xl mb-2">{channel === "sms" ? "📱" : channel === "email" ? "📧" : "📤"}</p>
                <p className="font-semibold text-gray-700">Sending...</p>
                {channel === "whatsapp" && <><p className="text-sm text-gray-400 mt-1">{progress.current} of {progress.total}</p>
                <div className="bg-gray-100 rounded-full h-2 mt-3 overflow-hidden"><div className="bg-kgreen-700 h-2 rounded-full transition-all" style={{ width:(progress.current/progress.total*100)+"%" }}/></div></>}
              </div>
            ) : (
              <button onClick={handleSend}
                disabled={!message.trim() || (needsRecipients && selected.size === 0) || (channel==="email" && !subject.trim())}
                className="btn-green">
                {channel==="whatsapp" ? "📤" : channel==="sms" ? "📱" : "📧"}{" "}
                Send to {selected.size > 0 ? selected.size + " Customer" + (selected.size > 1 ? "s" : "") : "Selected"}
                {channel==="whatsapp" && selected.size > 0 ? " · " + selected.size + " credits" : ""}
              </button>
            )
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {history.length === 0 ? (
            <div className="text-center py-16"><p className="text-5xl mb-3">📭</p><p className="font-semibold text-gray-500">No campaigns yet</p></div>
          ) : history.map(c => {
            const ch = CHANNELS.find(x => x.id === c.channel);
            return (
              <div key={c._id} className="card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{ch?.icon || "📨"}</span>
                  <span className="font-bold text-gray-800 text-sm capitalize">{ch?.label || c.channel}</span>
                  {c.status === "draft" && <span className="badge-purple">Draft</span>}
                </div>
                <p className="text-gray-600 text-sm line-clamp-2">{c.message}</p>
                <div className="flex justify-between mt-3 pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-400">{c.recipientCount > 0 ? "👥 " + c.recipientCount + " recipients" : "📝 Not sent yet"}</span>
                  <span className="text-xs text-gray-300">{new Date(c.createdAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
