import React, { useState } from "react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import PlanBadge from "../components/PlanBadge";

export default function Settings() {
  const { user, refresh, logout } = useAuth();
  const navigate                  = useNavigate();
  const [form, setForm]           = useState({ shopDescription: user?.shopDescription||"", phone: user?.phone||"", category: user?.category||"General", city: user?.city||"" });

  const CATEGORIES = ["Food & Grocery","Fashion","Beauty & Health","Electronics","Home & Living","Agriculture","Phones & Accessories","Baby & Kids","Automotive","Services","General"];
  const [loading, setLoading]     = useState(false);

  const handleSave = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await api.patch("/auth/shop", form); await refresh(); toast.success("Settings saved!"); } catch (err) { toast.error("Save failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="page pb-24">
      <div className="bg-kgreen-700 px-5 pt-12 pb-6 rounded-b-[2rem]">
        <h1 className="font-display text-2xl font-bold text-white mb-1">Settings</h1>
        <div className="flex items-center gap-2">
          <span className="text-kgreen-100 text-sm">{user?.email}</span>
          <PlanBadge plan={user?.plan||"free"} />
        </div>
      </div>
      <div className="mx-5 mt-4">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Shop Info</p>
            <div className="flex flex-col gap-4">
              <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">Shop Name</label>
                <div className="input bg-gray-50 text-gray-400">{user?.name}</div></div>
              <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">WhatsApp Number</label>
                <input type="tel" inputMode="tel" placeholder="+234 800 000 0000" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="input"/></div>
              <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">Category</label>
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="input py-3">
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select></div>
            <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">Your City</label>
              <input type="text" placeholder="e.g. Lagos, Kano, Abuja..." value={form.city} onChange={e=>setForm({...form,city:e.target.value})} className="input"/></div>
            <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">Shop Description</label>
                <input type="text" placeholder="e.g. Fresh groceries daily" value={form.shopDescription} onChange={e=>setForm({...form,shopDescription:e.target.value})} className="input"/></div>
            </div>
          </div>
          <button type="submit" className="btn-green" disabled={loading}>{loading?"⏳ Saving...":"Save Settings"}</button>
        </form>
        <div className="mt-4 card">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Account</p>
          <div className="flex flex-col gap-2">
            <button onClick={()=>navigate("/billing")} className="flex items-center justify-between py-3 active:bg-gray-50 rounded-xl px-1">
              <div className="flex items-center gap-3"><span className="text-xl">💳</span><div><p className="font-semibold text-gray-700 text-sm">Plans & Credits</p><p className="text-xs text-gray-400">Manage subscription</p></div></div>
              <span className="text-gray-300 text-lg">›</span>
            </button>
            <button onClick={()=>navigate("/reseller")} className="flex items-center justify-between py-3 active:bg-gray-50 rounded-xl px-1">
              <div className="flex items-center gap-3"><span className="text-xl">🤝</span><div><p className="font-semibold text-gray-700 text-sm">Reseller Program</p><p className="text-xs text-gray-400">Earn 30% commission</p></div></div>
              <span className="text-gray-300 text-lg">›</span>
            </button>
            <button onClick={()=>{logout();navigate("/login");}} className="flex items-center justify-between py-3 active:bg-red-50 rounded-xl px-1">
              <div className="flex items-center gap-3"><span className="text-xl">🚪</span><div><p className="font-semibold text-red-500 text-sm">Log Out</p></div></div>
              <span className="text-gray-300 text-lg">›</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
