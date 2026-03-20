import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function VerifyPhone() {
  const { user, refresh }         = useAuth();
  const navigate                  = useNavigate();
  const [phone, setPhone]         = useState(user?.phone || "");
  const [otp, setOtp]             = useState("");
  const [step, setStep]           = useState("phone"); // phone | otp | done
  const [sending, setSending]     = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // If already verified, redirect home
  useEffect(() => {
    if (user?.phoneVerified) navigate("/");
  }, [user, navigate]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOtp = async () => {
    if (!phone.trim()) { toast.error("Enter your phone number"); return; }
    setSending(true);
    try {
      const res = await api.post("/verify/send-otp", { phone });
      toast.success("OTP sent to your phone! 📱");
      setStep("otp");
      setCountdown(60); // 60 second resend cooldown
      // Dev mode: auto-fill OTP if returned
      if (res.data.otp) {
        setOtp(res.data.otp);
        toast("Dev mode: OTP auto-filled", { icon:"🔧" });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send OTP");
    } finally { setSending(false); }
  };

  const confirmOtp = async () => {
    if (otp.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setConfirming(true);
    try {
      await api.post("/verify/confirm-otp", { phone, otp });
      await refresh();
      setStep("done");
      toast.success("Phone verified! ✅");
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      toast.error(err.response?.data?.error || "Wrong OTP");
    } finally { setConfirming(false); }
  };

  return (
    <div className="min-h-screen bg-kgreen-700 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8">
        <div className="w-20 h-20 bg-kgold-500 rounded-3xl flex items-center justify-center mb-5 shadow-2xl shadow-kgreen-900">
          <span className="text-4xl">📱</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-white tracking-tight">Verify your number</h1>
        <p className="text-kgreen-100 mt-2 text-sm text-center leading-relaxed">
          This protects your shop and customers from fraud. One real phone number per account.
        </p>
      </div>

      {/* White card */}
      <div className="bg-white rounded-t-[2rem] px-6 pt-8 pb-10">

        {step === "phone" && (
          <>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-2">Enter your WhatsApp number</h2>
            <p className="text-sm text-gray-400 mb-6">We will send you a 6-digit code to confirm</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-500 mb-1.5 block">WhatsApp Number</label>
                <input type="tel" inputMode="tel" placeholder="+234 800 000 0000"
                  value={phone} onChange={e => setPhone(e.target.value)} className="input"/>
                <p className="text-xs text-gray-300 mt-1">Include country code — e.g. +234 for Nigeria</p>
              </div>
              <button onClick={sendOtp} disabled={sending} className="btn-green">
                {sending ? "⏳ Sending..." : "📱 Send Verification Code"}
              </button>
              <button onClick={() => navigate("/")}
                className="text-center text-sm text-gray-400 font-medium py-2">
                Skip for now — verify later
              </button>
            </div>
          </>
        )}

        {step === "otp" && (
          <>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-2">Enter the 6-digit code</h2>
            <p className="text-sm text-gray-400 mb-6">
              Sent to <span className="font-semibold text-gray-700">{phone}</span>
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Verification Code</label>
                <input type="text" inputMode="numeric" placeholder="123456"
                  maxLength={6} value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}
                  className="input text-2xl font-bold tracking-widest text-center"/>
              </div>
              <button onClick={confirmOtp} disabled={confirming || otp.length !== 6} className="btn-green">
                {confirming ? "⏳ Verifying..." : "✅ Verify Phone"}
              </button>
              <button onClick={() => { if (countdown === 0) { sendOtp(); } }}
                disabled={countdown > 0}
                className={`text-center text-sm font-medium py-2 ${countdown > 0 ? "text-gray-300" : "text-kgreen-700"}`}>
                {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
              </button>
              <button onClick={() => setStep("phone")} className="text-center text-sm text-gray-400 py-1">
                ← Change number
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="text-center py-6">
            <p className="text-6xl mb-4">✅</p>
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">Phone Verified!</h2>
            <p className="text-gray-400 text-sm">Your account is now active. Taking you to your shop...</p>
          </div>
        )}

        {/* Why we do this */}
        {step === "phone" && (
          <div className="mt-6 bg-kgreen-50 rounded-2xl p-4 border border-kgreen-100">
            <p className="text-xs font-bold text-kgreen-700 mb-2">🔒 Why we verify phone numbers</p>
            <div className="flex flex-col gap-2">
              {[
                "Prevents fake shops from impersonating real ones",
                "Stops people creating hundreds of free accounts",
                "Gives your customers confidence your shop is real",
                "Required before your shop appears in Discover",
              ].map(text => (
                <div key={text} className="flex items-start gap-2">
                  <span className="text-kgreen-600 font-bold text-xs mt-0.5">✓</span>
                  <p className="text-xs text-kgreen-700">{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
