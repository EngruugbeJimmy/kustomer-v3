import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login }             = useAuth();
  const navigate              = useNavigate();
  const [sp]                  = useSearchParams();
  const [form, setForm]       = useState({ email:"", password:"" });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error("Fill all fields"); return; }
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back! 👋");
      navigate("/");
    } catch (err) { toast.error(err.response?.data?.error || "Login failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-kgreen-700 flex flex-col">
      {/* Green hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8">
        <div className="w-20 h-20 bg-kgold-500 rounded-3xl flex items-center justify-center
                        mb-5 shadow-2xl shadow-kgreen-900">
          <span className="text-4xl">🛍️</span>
        </div>
        <h1 className="font-display text-4xl font-bold text-white tracking-tight">Kustomer</h1>
        <p className="text-kgreen-100 mt-2 text-sm">Your shop. Your customers. WhatsApp.</p>
      </div>

      {/* White card */}
      <div className="bg-white rounded-t-[2rem] px-6 pt-8 pb-10 shadow-2xl">
        <h2 className="font-display text-2xl font-bold text-gray-900 mb-6">Log in to your shop</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Email address</label>
            <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm({...form, email:e.target.value})} className="input" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-500">Password</label>
              <Link to="/forgot-password" className="text-xs text-kgreen-700 font-semibold">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••"
                value={form.password}
                onChange={e => setForm({...form, password:e.target.value})}
                className="input pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-green mt-2" disabled={loading}>
            {loading ? "⏳ Logging in..." : "Log In"}
          </button>
        </form>
        <p className="text-center text-gray-400 mt-5 text-sm">
          No account? <Link to="/signup" className="text-kgreen-700 font-semibold">Sign up free →</Link>
        </p>
      </div>
    </div>
  );
}
