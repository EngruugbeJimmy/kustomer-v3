import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const { signup }            = useAuth();
  const navigate              = useNavigate();
  const [sp]                  = useSearchParams();
  const [form, setForm]       = useState({ name:"", email:"", password:"", phone:"", resellerCode: sp.get("ref")||"" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.phone) { toast.error("Fill all required fields"); return; }
    if (form.password.length < 6) { toast.error("Password needs 6+ characters"); return; }
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password, form.phone, form.resellerCode);
      toast.success("Shop created! 🎉");
      navigate("/");
    } catch (err) { toast.error(err.response?.data?.error || "Signup failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-kgreen-700 flex flex-col">
      <div className="flex items-center justify-center px-8 pt-14 pb-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-kgold-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl">
            <span className="text-3xl">🛍️</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Create your shop</h1>
          <p className="text-kgreen-100 text-xs mt-1">Free forever. No credit card needed.</p>
        </div>
      </div>
      <div className="bg-white rounded-t-[2rem] px-6 pt-6 pb-10 flex-1">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Shop Name *</label>
            <input type="text" placeholder="e.g. Mama Ngozi Store" value={form.name}
              onChange={e => setForm({...form, name:e.target.value})} className="input" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-500 mb-1.5 block">
              WhatsApp Number * <span className="text-gray-300 font-normal text-xs">(customers order on this)</span>
            </label>
            <input type="tel" inputMode="tel" placeholder="+234 800 000 0000" value={form.phone}
              onChange={e => setForm({...form, phone:e.target.value})} className="input" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Email *</label>
            <input type="email" inputMode="email" placeholder="you@example.com" value={form.email}
              onChange={e => setForm({...form, email:e.target.value})} className="input" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Password *</label>
            <input type="password" placeholder="At least 6 characters" value={form.password}
              onChange={e => setForm({...form, password:e.target.value})} className="input" />
          </div>
          {form.resellerCode && (
            <div className="card bg-kgreen-50 border-kgreen-100 flex items-center gap-2 py-3">
              <span className="text-lg">🤝</span>
              <div><p className="text-xs font-semibold text-kgreen-700">Referred by a partner</p>
              <p className="text-xs text-kgreen-600">Code: {form.resellerCode}</p></div>
            </div>
          )}
          <button type="submit" className="btn-green mt-1" disabled={loading}>
            {loading ? "⏳ Creating shop..." : "🛍️ Create Free Shop"}
          </button>
        </form>
        <p className="text-center text-gray-400 mt-5 text-sm">
          Already have an account? <Link to="/login" className="text-kgreen-700 font-semibold">Log in →</Link>
        </p>
      </div>
    </div>
  );
}

// Name similarity check utility — call before submitting signup
export async function checkShopNameSimilarity(name, api) {
  try {
    const res = await api.post("/verify/check-name", { name });
    return res.data; // { ok, warning, message, similar }
  } catch (err) {
    return { ok: true }; // fail open — don't block signup on check failure
  }
}
