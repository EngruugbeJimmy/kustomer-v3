import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const SEO_SCORE_COLOR = s => s >= 80 ? "text-kgreen-700" : s >= 60 ? "text-amber-600" : "text-red-500";
const SEO_SCORE_BAR   = s => s >= 80 ? "bg-kgreen-700" : s >= 60 ? "bg-amber-500" : "bg-red-400";

function SeoCard({ product, onGenerate, onSave }) {
  const [seo, setSeo]         = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState({ description:"", keywords:"", metaTitle:"", metaDesc:"", slug:"" });

  useEffect(() => {
    api.get("/ai-seo/" + product._id).then(r => {
      if (r.data.seo) { setSeo(r.data.seo); setForm({ description:r.data.seo.description||"", keywords:(r.data.seo.keywords||[]).join(", "), metaTitle:r.data.seo.metaTitle||"", metaDesc:r.data.seo.metaDesc||"", slug:r.data.seo.slug||"" }); }
    }).catch(() => {});
  }, [product._id]);

  const generate = async () => {
    setLoading(true);
    try {
      const r = await api.post("/ai-seo/generate", { productId: product._id });
      const s = r.data.seo;
      setSeo(s);
      setForm({ description:s.description||"", keywords:(s.keywords||[]).join(", "), metaTitle:s.metaTitle||"", metaDesc:s.metaDesc||"", slug:s.slug||"" });
      setOpen(true);
      toast.success("SEO content generated! ✨");
      onGenerate?.();
    } catch (err) { toast.error(err.response?.data?.error || "AI SEO failed"); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.patch("/ai-seo/" + product._id, {
        description: form.description,
        keywords: form.keywords.split(",").map(k => k.trim()).filter(Boolean),
        metaTitle: form.metaTitle,
        metaDesc: form.metaDesc,
        slug: form.slug,
      });
      setSeo(r.data.seo);
      toast.success("SEO saved!");
      onSave?.();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="card">
      {/* Product row */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50">
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-sm truncate">{product.name}</p>
          <p className="text-xs text-gray-400">{product.currency}{Number(product.price).toLocaleString()}</p>
        </div>
        {seo && (
          <div className="text-right flex-shrink-0">
            <p className={`font-display font-bold text-lg ${SEO_SCORE_COLOR(seo.score||0)}`}>{seo.score||0}</p>
            <p className="text-xs text-gray-400">SEO score</p>
          </div>
        )}
      </div>

      {seo && (
        <div className="mb-3">
          <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full rounded-full ${SEO_SCORE_BAR(seo.score||0)}`} style={{ width:(seo.score||0)+"%" }}/>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={generate} disabled={loading}
          className="flex-1 bg-kgold-500 text-kgold-700 font-bold text-sm py-2.5 rounded-xl active:scale-95 transition-all">
          {loading ? "✨ Generating..." : seo ? "✨ Regenerate" : "✨ Generate SEO"}
        </button>
        {seo && (
          <button onClick={() => setOpen(!open)}
            className="bg-gray-100 text-gray-600 font-bold text-sm px-4 py-2.5 rounded-xl active:scale-95">
            {open ? "▲ Close" : "✏️ Edit"}
          </button>
        )}
      </div>

      {/* Expanded SEO editor */}
      {open && seo && (
        <div className="mt-4 flex flex-col gap-3 pt-4 border-t border-gray-100">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">SEO Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} rows={3} className="input resize-none text-sm"/>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Keywords (comma separated)</label>
            <input type="text" value={form.keywords} onChange={e => setForm({...form, keywords:e.target.value})} className="input text-sm"/>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Meta Title (max 60 chars)</label>
            <input type="text" value={form.metaTitle} onChange={e => setForm({...form, metaTitle:e.target.value})} className="input text-sm" maxLength={60}/>
            <p className="text-xs text-gray-300 text-right mt-1">{form.metaTitle.length}/60</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Meta Description (max 160 chars)</label>
            <textarea value={form.metaDesc} onChange={e => setForm({...form, metaDesc:e.target.value})} rows={2} className="input resize-none text-sm" maxLength={160}/>
            <p className="text-xs text-gray-300 text-right mt-1">{form.metaDesc.length}/160</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">URL Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-mono flex-shrink-0">/shop/{"{slug}"}/</span>
              <input type="text" value={form.slug} onChange={e => setForm({...form, slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-")})} className="input text-sm flex-1"/>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="btn-green">
            {saving ? "⏳ Saving..." : "💾 Save SEO Content"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AISeo() {
  const { user }              = useAuth();
  const navigate              = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/products").then(r => setProducts(r.data.products)).catch(() => toast.error("Failed to load")).finally(() => setLoading(false));
  }, []);

  const canUseSeo = user?.plan !== "free";

  return (
    <div className="page pb-24">
      <div className="bg-kgreen-700 px-5 pt-12 pb-6 rounded-b-[2rem]">
        <h1 className="font-display text-2xl font-bold text-white mb-1">AI SEO</h1>
        <p className="text-kgreen-100 text-sm">Make your products findable on Google</p>
      </div>

      {!canUseSeo ? (
        <div className="mx-5 mt-5">
          <div className="card border-kgold-100 bg-kgold-50 text-center py-8">
            <p className="text-4xl mb-3">✨</p>
            <p className="font-display font-bold text-gray-800 text-lg mb-2">AI SEO requires Starter plan</p>
            <p className="text-sm text-gray-500 mb-4">Auto-generate SEO descriptions, keywords, meta tags and Google-friendly URLs for all your products</p>
            <button onClick={() => navigate("/billing")} className="btn-gold">Upgrade to Starter</button>
          </div>
          <div className="mt-4 card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">What AI SEO does</p>
            {[
              ["✍️","Rewrites product descriptions to rank on Google"],
              ["🔑","Suggests 5 keywords per product"],
              ["📋","Generates meta title + description (160 chars)"],
              ["🔗","Creates SEO-friendly URL slugs"],
              ["📊","Scores each product 0–100 for SEO quality"],
            ].map(([icon,text]) => (
              <div key={text} className="flex items-center gap-3 mb-3 last:mb-0">
                <span className="text-xl flex-shrink-0">{icon}</span>
                <p className="text-sm text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {loading ? (
            [...Array(3)].map((_,i) => <div key={i} className="card animate-pulse h-24 bg-gray-50"/>)
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-3">📦</p>
              <p className="font-semibold text-gray-500">No products yet</p>
              <button onClick={() => navigate("/products")} className="mt-4 text-kgreen-700 font-semibold text-sm">Add products first →</button>
            </div>
          ) : (
            <>
              <div className="card bg-kgreen-50 border-kgreen-100">
                <p className="text-xs font-bold text-kgreen-700 mb-1">💡 How it works</p>
                <p className="text-xs text-kgreen-600 leading-relaxed">Tap "Generate SEO" on each product. The AI rewrites the description, adds keywords, and creates a meta title — making your catalog page findable on Google for free.</p>
              </div>
              {products.map(p => <SeoCard key={p._id} product={p} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
