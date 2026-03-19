import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";
import { TEMPLATES, buildBroadcastMessage, sendWhatsApp } from "../utils/whatsapp";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const APP_URL = process.env.REACT_APP_URL || window.location.origin;

export default function Broadcast() {
  const { user, refresh }                 = useAuth();
  const navigate                          = useNavigate();
  const [sp]                              = useSearchParams();
  const [customers, setCustomers]         = useState([]);
  const [selected, setSelected]           = useState(new Set());
  const [message, setMessage]             = useState("");
  const [includeLink, setIncludeLink]     = useState(true);
  const [selectAll, setSelectAll]         = useState(false);
  const [sending, setSending]             = useState(false);
  const [progress, setProgress]           = useState({ current:0, total:0 });
  const [history, setHistory]             = useState([]);
  const [tab, setTab]                     = useState(sp.get("tab")||"compose");
  const [loading, setLoading]             = useState(true);

  const catalogUrl = APP_URL + "/shop/" + user?.shopSlug;
  const finalMessage = includeLink ? buildBroadcastMessage(message, catalogUrl) : message;
  const credits = user?.credits || 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, mr] = await Promise.all([api.get("/customers"), api.get("/messages")]);
      setCustomers(cr.data.customers); setHistory(mr.data.messages||[]);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ fetchData(); },[fetchData]);
  useEffect(()=>{ setSelected(selectAll ? new Set(customers.map(c=>c._id)) : new Set()); },[selectAll,customers]);

  const toggle = id => setSelected(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  const handleSend = async () => {
    if (!message.trim()) { toast.error("Write a message first"); return; }
    if (selected.size===0) { toast.error("Select at least one customer"); return; }
    if (credits < selected.size) { toast.error("Not enough credits! Need " + selected.size + ", have " + credits); navigate("/billing"); return; }
    const recipients = customers.filter(c=>selected.has(c._id));
    setSending(true); setProgress({current:0, total:recipients.length});
    try {
      for (let i=0; i<recipients.length; i++) {
        sendWhatsApp(recipients[i].phone, finalMessage);
        setProgress({current:i+1, total:recipients.length});
        if (i < recipients.length-1) await new Promise(r=>setTimeout(r,900));
      }
      await api.post("/messages", { text:finalMessage, recipients:recipients.map(r=>({name:r.name,phone:r.phone})) });
      await refresh();
      toast.success("Sent to "+recipients.length+" customers! 🎉");
      const mr = await api.get("/messages"); setHistory(mr.data.messages);
      setMessage(""); setSelected(new Set()); setSelectAll(false);
    } catch (err) {
      if (err.response?.status===402) { toast.error("Not enough credits! Upgrade your plan."); navigate("/billing"); }
      else toast.error("Something went wrong");
    } finally { setSending(false); setProgress({current:0,total:0}); }
  };

  return (
    <div className="page pb-28">
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-4">
          <div><h1 className="font-display text-2xl font-bold text-white">Broadcast</h1>
            <p className="text-kgreen-100 text-xs mt-0.5">{credits} credits remaining</p></div>
          {credits < 50 && (
            <button onClick={()=>navigate("/billing")} className="bg-kgold-500 text-kgold-700 text-xs font-bold px-3 py-2 rounded-xl active:scale-95">Top Up</button>
          )}
        </div>
        <div className="flex bg-kgreen-800 rounded-2xl p-1 gap-1">
          {[["compose","✏️ Compose"],["history","📋 History"]].map(([key,lbl])=>(
            <button key={key} onClick={()=>setTab(key)}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all
                ${tab===key ? "bg-kgold-500 text-kgold-700" : "text-kgreen-100"}`}>{lbl}</button>
          ))}
        </div>
      </div>

      {tab==="compose" && (
        <div className="mx-5 mt-4 flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Quick Templates</p>
            <div className="flex flex-col gap-2">
              {TEMPLATES.map((t,i)=>(
                <button key={i} onClick={()=>setMessage(t.text)} className="card text-left flex items-center gap-3 active:bg-kgreen-50 transition-all active:scale-98">
                  <span className="text-2xl">{t.emoji}</span><span className="font-medium text-gray-700 text-sm">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Message</p>
            <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3} placeholder="Type your message..." className="input resize-none" maxLength={800}/>
            <p className="text-xs text-gray-300 text-right mt-1">{message.length}/800</p>
          </div>
          {/* Include link toggle */}
          <div className="card flex items-center justify-between py-3">
            <div><p className="font-semibold text-gray-700 text-sm">📎 Include shop link</p><p className="text-xs text-gray-400">Customers tap to view & order</p></div>
            <button onClick={()=>setIncludeLink(!includeLink)}
              className={`w-12 h-6 rounded-full transition-colors ${includeLink?"bg-kgreen-700":"bg-gray-200"}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${includeLink?"translate-x-6":"translate-x-0.5"}`}/>
            </button>
          </div>
          {message.trim() && (
            <div className="bg-kgreen-50 border border-kgreen-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-kgreen-700 mb-2">📱 Preview</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{finalMessage}</p>
            </div>
          )}
          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                Recipients {selected.size>0 && <span className="bg-kgreen-700 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">{selected.size}</span>}
              </p>
              <button onClick={()=>setSelectAll(!selectAll)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${selectAll?"bg-kgreen-700 text-white":"bg-gray-100 text-gray-500"}`}>
                {selectAll?"✓ All selected":"Select all"}
              </button>
            </div>
            {loading ? <p className="text-gray-400 text-sm text-center py-4">Loading...</p> :
            customers.length===0 ? (
              <div className="card text-center py-5"><p className="text-gray-400 text-sm">No customers yet.</p>
                <a href="/customers" className="text-kgreen-700 font-semibold text-sm mt-1 block">Add customers →</a></div>
            ) : (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {customers.map(c=>{
                  const sel=selected.has(c._id);
                  return (
                    <button key={c._id} onClick={()=>toggle(c._id)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all active:scale-98
                                  ${sel?"border-kgreen-700 bg-kgreen-50":"border-gray-100 bg-white"}`}>
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${sel?"border-kgreen-700 bg-kgreen-700":"border-gray-200"}`}>
                        {sel && <span className="text-white text-xs font-bold">✓</span>}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{c.name}</p>
                        <p className="text-xs text-gray-400 truncate">{c.phone}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Credits warning */}
          {selected.size > credits && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-3 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <p className="text-xs text-red-700 font-semibold">Not enough credits. Need {selected.size}, have {credits}.</p>
            </div>
          )}
          {sending ? (
            <div className="card text-center py-5">
              <p className="text-3xl mb-2">📤</p><p className="font-semibold text-gray-700">Opening WhatsApp...</p>
              <p className="text-sm text-gray-400 mt-1">{progress.current} of {progress.total}</p>
              <div className="bg-gray-100 rounded-full h-2 mt-3 overflow-hidden">
                <div className="bg-kgreen-700 h-2 rounded-full transition-all" style={{width:(progress.current/progress.total*100)+"%"}}/>
              </div>
            </div>
          ) : (
            <button onClick={handleSend} disabled={!message.trim()||selected.size===0||selected.size>credits} className="btn-green">
              📤 Send to {selected.size>0 ? selected.size+" Customer"+(selected.size>1?"s":"") : "Selected"}
              {selected.size>0 && " · "+selected.size+" credits"}
            </button>
          )}
        </div>
      )}
      {tab==="history" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {history.length===0 ? (
            <div className="text-center py-16"><p className="text-5xl mb-3">📭</p><p className="font-semibold text-gray-500">No broadcasts yet</p></div>
          ) : history.map(msg=>(
            <div key={msg._id} className="card">
              <p className="text-gray-700 text-sm line-clamp-2">{msg.text}</p>
              <div className="flex justify-between mt-3 pt-3 border-t border-gray-50">
                <span className="text-xs text-gray-400">👥 {msg.recipientCount} · ⚡ {msg.creditsUsed||msg.recipientCount} credits</span>
                <span className="text-xs text-gray-300">{new Date(msg.createdAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
