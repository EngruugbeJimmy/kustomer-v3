import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const APP_URL = process.env.REACT_APP_URL || window.location.origin;

export default function Domains() {
  const { user, refresh }           = useAuth();
  const navigate                    = useNavigate();
  const [data, setData]             = useState(null);
  const [domain, setDomain]         = useState("");
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const [instructions, setInstructions] = useState(null);

  useEffect(() => {
    api.get("/domains/me").then(r => { setData(r.data); setDomain(r.data.customDomain || ""); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const connectDomain = async () => {
    if (!domain.trim()) { toast.error("Enter a domain"); return; }
    setSaving(true);
    try {
      const r = await api.post("/domains/connect", { domain: domain.trim() });
      setInstructions(r.data.instructions);
      setData(prev => ({ ...prev, customDomain:r.data.domain, domainVerified:false }));
      toast.success("Domain saved! Follow the DNS instructions below.");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setSaving(false); }
  };

  const verify = async () => {
    setVerifying(true);
    try {
      const r = await api.post("/domains/verify");
      setData(prev => ({ ...prev, domainVerified:true }));
      await refresh();
      toast.success(r.data.message || "Domain verified! 🎉");
    } catch (err) { toast.error(err.response?.data?.error || "Verification failed"); }
    finally { setVerifying(false); }
  };

  const canConnectDomain = data?.canConnectDomain;
  const subdomain = user?.shopSlug + ".kustomer.app";

  if (loading) return <div className="page items-center justify-center"><p className="text-gray-400">Loading...</p></div>;

  return (
    <div className="page pb-24">
      <div className="bg-kgreen-700 px-5 pt-12 pb-6 rounded-b-[2rem]">
        <h1 className="font-display text-2xl font-bold text-white mb-1">Custom Domain</h1>
        <p className="text-kgreen-100 text-sm">Give your shop a professional web address</p>
      </div>

      <div className="mx-5 mt-4 flex flex-col gap-4">

        {/* Free subdomain */}
        <div className="card border-kgreen-100 bg-kgreen-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🌐</span>
            <span className="font-bold text-kgreen-700 text-sm">Your Free Subdomain</span>
            <span className="badge-green">Active</span>
          </div>
          <p className="font-mono text-sm text-gray-700 bg-white rounded-xl px-3 py-2 border border-kgreen-100 mb-2 break-all">{subdomain}</p>
          <p className="text-xs text-kgreen-600">This link always works — share it anywhere. No setup needed.</p>
          <button onClick={() => { navigator.clipboard.writeText("https://"+subdomain); toast.success("Copied!"); }}
            className="mt-3 w-full bg-kgreen-700 text-white font-bold text-sm py-2.5 rounded-xl active:scale-95">
            📋 Copy Subdomain Link
          </button>
        </div>

        {/* Custom domain */}
        {!canConnectDomain ? (
          <div className="card border-kgold-100 bg-kgold-50 text-center py-6">
            <p className="text-3xl mb-2">🔒</p>
            <p className="font-display font-bold text-gray-800 mb-1">Custom domain requires Pro plan</p>
            <p className="text-sm text-gray-500 mb-4">Connect your own domain like <span className="font-mono">shop.yourstore.com</span></p>
            <button onClick={() => navigate("/billing")} className="btn-gold">Upgrade to Pro</button>
          </div>
        ) : (
          <>
            <div className="card">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Connect Your Own Domain</p>
              <div className="flex gap-2">
                <input type="text" placeholder="e.g. shop.mystore.com" value={domain}
                  onChange={e => setDomain(e.target.value)} className="input flex-1 text-sm"/>
                <button onClick={connectDomain} disabled={saving}
                  className="bg-kgreen-700 text-white font-bold text-sm px-4 py-3 rounded-xl active:scale-95 flex-shrink-0">
                  {saving ? "⏳" : "Save"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Use your own domain without www for root domain, or include www</p>
            </div>

            {(instructions || data?.customDomain) && (
              <div className="card border-amber-100 bg-amber-50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⚙️</span>
                  <span className="font-bold text-amber-800 text-sm">DNS Setup Instructions</span>
                  {data?.domainVerified && <span className="badge-green">✓ Verified</span>}
                </div>
                <p className="text-xs text-amber-700 mb-3">Go to your domain registrar (Namecheap, GoDaddy, Cloudflare etc) and add this DNS record:</p>
                <div className="bg-white rounded-xl p-3 border border-amber-100 font-mono text-xs">
                  <div className="grid grid-cols-2 gap-1 mb-1">
                    <span className="text-gray-400">Type:</span><span className="font-bold text-gray-800">CNAME</span>
                    <span className="text-gray-400">Host:</span><span className="font-bold text-gray-800">{instructions?.host || (data?.customDomain?.startsWith("www.") ? "www" : "@")}</span>
                    <span className="text-gray-400">Value:</span><span className="font-bold text-kgreen-700">kustomer.app</span>
                    <span className="text-gray-400">TTL:</span><span className="font-bold text-gray-800">3600</span>
                  </div>
                </div>
                <p className="text-xs text-amber-600 mt-2">⏱ DNS changes take 24–48 hours to propagate</p>
                {!data?.domainVerified && (
                  <button onClick={verify} disabled={verifying}
                    className="mt-3 w-full bg-kgreen-700 text-white font-bold text-sm py-2.5 rounded-xl active:scale-95">
                    {verifying ? "⏳ Verifying..." : "✓ I've Added the DNS Record — Verify"}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Tips */}
        <div className="card">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Tips</p>
          {[
            ["🆓","Free subdomain works immediately — use it to start getting orders today"],
            ["🔗","Share your subdomain link in WhatsApp broadcasts"],
            ["💼","Custom domain makes your shop look more professional to customers"],
            ["📱","Both links work perfectly on mobile — no app needed for customers"],
          ].map(([icon,text]) => (
            <div key={text} className="flex gap-3 items-start mb-3 last:mb-0">
              <span className="text-lg flex-shrink-0">{icon}</span>
              <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
