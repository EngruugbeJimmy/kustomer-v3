import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../utils/api";

const PLATFORMS = [
  { key:"tiktok",    label:"TikTok",    icon:"🎵", color:"#010101", light:"#f0f0f0", tc:"#010101",  hint:"Short punchy hook + hashtags" },
  { key:"instagram", label:"Instagram", icon:"📸", color:"#E1306C", light:"#fce7f0", tc:"#9b1a3f",  hint:"Lifestyle tone + 5 hashtags" },
  { key:"facebook",  label:"Facebook",  icon:"📘", color:"#1877F2", light:"#e8f0fe", tc:"#1253a0",  hint:"Conversational, longer copy" },
  { key:"twitter",   label:"X / Twitter",icon:"𝕏", color:"#000000", light:"#f0f0f0", tc:"#111111", hint:"Under 280 chars, punchy" },
  { key:"whatsapp",  label:"WA Status", icon:"💬", color:"#25D366", light:"#dcfce7", tc:"#166534",  hint:"Short + catalog link" },
];

export default function SocialPost() {
  const [products, setProducts]       = useState([]);
  const [selected, setSelected]       = useState({ tiktok:true, instagram:true, facebook:true, twitter:false, whatsapp:true });
  const [productId, setProductId]     = useState("");
  const [prompt, setPrompt]           = useState("");
  const [generating, setGenerating]   = useState(false);
  const [captions, setCaptions]       = useState({});
  const [copied, setCopied]           = useState("");

  useEffect(() => {
    api.get("/products").then(r => {
      setProducts(r.data.products || []);
      if (r.data.products?.length > 0) setProductId(r.data.products[0]._id);
    }).catch(() => {});
  }, []);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const togglePlatform = (key) => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    const allOn = PLATFORMS.every(p => selected[p.key]);
    const next = {};
    PLATFORMS.forEach(p => next[p.key] = !allOn);
    setSelected(next);
  };

  const generate = async () => {
    if (selectedCount === 0) { toast.error("Select at least one platform"); return; }
    setGenerating(true);
    setCaptions({});
    try {
      const platforms = PLATFORMS.filter(p => selected[p.key]).map(p => p.key);
      const res = await api.post("/marketing/social-multi", {
        platforms,
        productId: productId || null,
        prompt: prompt || "",
      });
      setCaptions(res.data.captions || {});
      toast.success("Captions ready! 🎉");
    } catch (err) {
      toast.error(err.response?.data?.error || "Generation failed");
    } finally { setGenerating(false); }
  };

  const copyCaption = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Copied!");
      setTimeout(() => setCopied(""), 2000);
    } catch { toast.error("Copy failed"); }
  };

  const shareCaption = (key, text) => {
    if (navigator.share) {
      navigator.share({ text });
    } else {
      copyCaption(key, text);
    }
  };

  const hasCaptions = Object.keys(captions).length > 0;

  return (
    <div className="page pb-24">

      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-6 rounded-b-[2rem]">
        <h1 className="font-display text-2xl font-bold text-white mb-1">Social Posts</h1>
        <p className="text-kgreen-100 text-sm">Generate captions for all platforms at once — free</p>
      </div>

      <div className="mx-5 mt-4 flex flex-col gap-4">

        {/* Platform selector */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              Select platforms
            </p>
            <button onClick={selectAll}
              className="text-xs font-semibold text-kgreen-700 active:scale-95">
              {PLATFORMS.every(p => selected[p.key]) ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {PLATFORMS.map(platform => (
              <button key={platform.key}
                onClick={() => togglePlatform(platform.key)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.98] text-left
                  ${selected[platform.key]
                    ? "border-kgreen-700 bg-kgreen-50"
                    : "border-gray-100 bg-gray-50"}`}>
                {/* Checkbox */}
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                  ${selected[platform.key] ? "bg-kgreen-700 border-kgreen-700" : "border-gray-300 bg-white"}`}>
                  {selected[platform.key] && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {/* Platform info */}
                <span style={{ fontSize:20 }}>{platform.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{platform.label}</p>
                  <p className="text-xs text-gray-400">{platform.hint}</p>
                </div>
                {/* Free badge */}
                <span className="bg-kgreen-50 text-kgreen-700 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                  Free
                </span>
              </button>
            ))}
          </div>

          {selectedCount > 0 && (
            <p className="text-xs text-kgreen-700 font-semibold text-center mt-3">
              {selectedCount} platform{selectedCount !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {/* Product + prompt */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="mb-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">
              Product (optional)
            </label>
            <select value={productId} onChange={e => setProductId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-kgreen-400">
              <option value="">General shop promotion</option>
              {products.map(p => (
                <option key={p._id} value={p._id}>
                  {p.name} — {p.currency}{Number(p.price).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">
              Direction (optional)
            </label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              rows={2} maxLength={200}
              placeholder="e.g. Make it feel like a Lagos market vibe, add urgency..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:border-kgreen-400"/>
          </div>
        </div>

        {/* Generate button */}
        <button onClick={generate} disabled={generating || selectedCount === 0}
          className={`py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98]
            ${generating || selectedCount === 0
              ? "bg-gray-100 text-gray-400"
              : "bg-kgreen-700 text-white shadow-lg shadow-kgreen-900/20"}`}>
          {generating
            ? "✨ Generating " + selectedCount + " captions..."
            : selectedCount === 0
              ? "Select at least one platform"
              : "✨ Generate " + selectedCount + " caption" + (selectedCount !== 1 ? "s" : "") + " — Free"}
        </button>

        {/* Loading state */}
        {generating && (
          <div className="bg-kgreen-50 border border-kgreen-100 rounded-2xl p-4 text-center">
            <p className="text-2xl mb-2 animate-spin inline-block">✨</p>
            <p className="text-sm font-semibold text-kgreen-700">Writing your captions...</p>
            <p className="text-xs text-kgreen-600 mt-1">One moment — crafting Naija-flavoured copy</p>
          </div>
        )}

        {/* Generated captions */}
        {hasCaptions && !generating && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">
              Your captions — tap to copy then post
            </p>
            {PLATFORMS.filter(p => captions[p.key]).map(platform => (
              <div key={platform.key}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Platform header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50"
                  style={{ background: platform.light }}>
                  <span style={{ fontSize:18 }}>{platform.icon}</span>
                  <p className="font-bold text-sm" style={{ color: platform.tc }}>{platform.label}</p>
                </div>
                {/* Caption text */}
                <div className="px-4 py-3">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {captions[platform.key]}
                  </p>
                </div>
                {/* Action buttons */}
                <div className="flex gap-2 px-4 pb-4">
                  <button onClick={() => copyCaption(platform.key, captions[platform.key])}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all border
                      ${copied === platform.key
                        ? "bg-kgreen-700 text-white border-kgreen-700"
                        : "bg-white text-gray-700 border-gray-200"}`}>
                    {copied === platform.key ? "✓ Copied!" : "📋 Copy"}
                  </button>
                  <button onClick={() => shareCaption(platform.key, captions[platform.key])}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-kgreen-700 text-white active:scale-95">
                    📤 Share
                  </button>
                </div>
              </div>
            ))}

            <div className="card bg-kgreen-50 border-kgreen-100 py-3 text-center">
              <p className="text-xs text-kgreen-700">
                Copy each caption → open the app → paste and post · All free, no credits used
              </p>
            </div>

            <button onClick={() => { setCaptions({}); setPrompt(""); }}
              className="text-center text-sm text-gray-400 font-medium py-2">
              Generate new captions →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
