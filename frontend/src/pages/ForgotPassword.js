import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";

export default function ForgotPassword() {
  const navigate          = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Enter your email address"); return; }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      // Always show success — never reveal if email exists
      setSent(true);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-kgreen-700 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8">
        <div className="w-20 h-20 bg-kgold-500 rounded-3xl flex items-center justify-center mb-5 shadow-2xl shadow-kgreen-900">
          <span className="text-4xl">🔑</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-white tracking-tight">
          {sent ? "Check your email" : "Forgot password?"}
        </h1>
        <p className="text-kgreen-100 mt-2 text-sm text-center leading-relaxed">
          {sent
            ? "If that email is registered, a reset link is on its way."
            : "No problem. Enter your email and we will send a reset link."}
        </p>
      </div>

      <div className="bg-white rounded-t-[2rem] px-6 pt-8 pb-10">
        {!sent ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-500 mb-1.5 block">
                Email address
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                autoFocus
                autoComplete="email"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-green">
              {loading ? "⏳ Sending..." : "Send Reset Link"}
            </button>
            <Link to="/login"
              className="text-center text-sm text-gray-400 font-medium py-2">
              ← Back to login
            </Link>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-kgreen-50 border border-kgreen-100 rounded-2xl p-5 text-center">
              <p className="text-4xl mb-3">📧</p>
              <p className="font-bold text-kgreen-700 text-base mb-1">Email sent</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Check <span className="font-semibold text-gray-700">{email}</span> for
                a reset link. It expires in 1 hour.
              </p>
            </div>
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              Did not receive it? Check your spam folder or{" "}
              <button onClick={() => setSent(false)}
                className="text-kgreen-700 font-semibold underline">
                try again
              </button>
            </p>
            <button onClick={() => navigate("/login")} className="btn-green">
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
