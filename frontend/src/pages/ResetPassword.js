import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";

export default function ResetPassword() {
  const navigate          = useNavigate();
  const [sp]              = useSearchParams();
  const token             = sp.get("token") || "";
  const email             = sp.get("email") || "";

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [showPass, setShowPass]   = useState(false);

  // Guard — if no token in URL, redirect to forgot password
  useEffect(() => {
    if (!token || !email) {
      toast.error("Invalid reset link. Request a new one.");
      navigate("/forgot-password");
    }
  }, [token, email, navigate]);

  const strength = (p) => {
    let s = 0;
    if (p.length >= 8)   s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#3b82f6", "#0a7a4b"];
  const s = strength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8)       { toast.error("Password must be at least 8 characters"); return; }
    if (!/[A-Z]/.test(password))   { toast.error("Password needs at least one uppercase letter"); return; }
    if (!/[0-9]/.test(password))   { toast.error("Password needs at least one number"); return; }
    if (password !== confirm)       { toast.error("Passwords do not match"); return; }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, email, password });
      setDone(true);
      toast.success("Password updated! ✅");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      toast.error(err.response?.data?.error || "Reset failed. The link may have expired.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-kgreen-700 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8">
        <div className="w-20 h-20 bg-kgold-500 rounded-3xl flex items-center justify-center mb-5 shadow-2xl shadow-kgreen-900">
          <span className="text-4xl">{done ? "✅" : "🔒"}</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-white tracking-tight">
          {done ? "Password updated!" : "Set new password"}
        </h1>
        <p className="text-kgreen-100 mt-2 text-sm text-center">
          {done ? "Taking you to login..." : "Choose a strong password for your account"}
        </p>
      </div>

      <div className="bg-white rounded-t-[2rem] px-6 pt-8 pb-10">
        {!done ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-500 mb-1.5 block">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-12"
                  autoFocus
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full"
                        style={{ background: i <= s ? strengthColor[s] : "#e5e7eb" }}/>
                    ))}
                  </div>
                  <p className="text-xs font-semibold" style={{ color: strengthColor[s] }}>
                    {strengthLabel[s]}
                  </p>
                </div>
              )}
              <div className="mt-2 flex flex-col gap-1">
                {[
                  [/.{8,}/,    "At least 8 characters"],
                  [/[A-Z]/,    "One uppercase letter"],
                  [/[0-9]/,    "One number"],
                ].map(([re, label]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${re.test(password) ? "text-kgreen-700" : "text-gray-300"}`}>
                      {re.test(password) ? "✓" : "○"}
                    </span>
                    <span className={`text-xs ${re.test(password) ? "text-kgreen-700" : "text-gray-400"}`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-500 mb-1.5 block">
                Confirm new password
              </label>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Type password again"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={`input ${confirm && confirm !== password ? "border-red-300" : ""}`}
                autoComplete="new-password"
              />
              {confirm && confirm !== password && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            <button type="submit" disabled={loading || password !== confirm || s < 2}
              className="btn-green">
              {loading ? "⏳ Updating..." : "Update Password"}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Your password has been updated. Redirecting to login...
            </p>
            <Link to="/login" className="btn-green inline-block">Go to Login</Link>
          </div>
        )}
      </div>
    </div>
  );
}
