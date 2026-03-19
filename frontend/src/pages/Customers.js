import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";

function AddModal({ onClose, onAdded }) {
  const [form, setForm]       = useState({ name:"", phone:"", notes:"" });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()||!form.phone.trim()) { toast.error("Name and phone required"); return; }
    setLoading(true);
    try {
      const r = await api.post("/customers", form);
      toast.success("Customer added! ✅"); onAdded(r.data.customer); onClose();
    } catch (err) {
      const msg = err.response?.data?.error||"Failed";
      if (msg.includes("limit")) toast.error(msg + " — upgrade your plan");
      else toast.error(msg);
    } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10" onClick={e=>e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5"/>
        <h2 className="font-display text-xl font-bold mb-5">Add Customer</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">Full Name *</label>
            <input type="text" placeholder="e.g. Chidi Okeke" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="input" autoFocus/></div>
          <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">WhatsApp Number *</label>
            <input type="tel" inputMode="tel" placeholder="+234 800 000 0000" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="input"/>
            <p className="text-xs text-gray-300 mt-1">Include country code e.g. +234</p></div>
          <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">Notes</label>
            <input type="text" placeholder="e.g. Buys bread daily" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="input"/></div>
          <div className="flex gap-3"><button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="submit" className="btn-green" disabled={loading}>{loading?"⏳ Saving...":"Add Customer"}</button></div>
        </form>
      </div>
    </div>
  );
}

export default function Customers() {
  const [sp] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(sp.get("add")==="true");

  const fetchC = useCallback(async (q="") => {
    setLoading(true);
    try { const r = await api.get("/customers",{ params: q?{search:q}:{} }); setCustomers(r.data.customers); }
    catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ fetchC(); },[fetchC]);
  useEffect(()=>{ const t=setTimeout(()=>fetchC(search),400); return ()=>clearTimeout(t); },[search,fetchC]);

  const handleDelete = async (id, name) => {
    if (!window.confirm("Remove "+name+"?")) return;
    try { await api.delete("/customers/"+id); setCustomers(prev=>prev.filter(c=>c._id!==id)); toast.success("Removed"); }
    catch { toast.error("Failed"); }
  };
  const initials = n => n.split(" ").map(x=>x[0]).join("").toUpperCase().slice(0,2);

  return (
    <div className="page pb-24">
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-4">
          <div><h1 className="font-display text-2xl font-bold text-white">Customers</h1>
            <p className="text-kgreen-100 text-xs mt-0.5">{customers.length} total</p></div>
          <button onClick={()=>setShowAdd(true)}
            className="bg-kgold-500 text-kgold-700 font-bold text-sm px-4 py-2 rounded-xl active:scale-95 shadow-lg">+ Add</button>
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-lg">🔍</span>
          <input type="search" placeholder="Search name or phone..." value={search} onChange={e=>setSearch(e.target.value)}
            className="w-full bg-kgreen-800 text-white border-0 rounded-2xl px-4 py-3 pl-11 text-sm placeholder-kgreen-100/50 focus:outline-none focus:ring-2 focus:ring-kgold-500"/>
        </div>
      </div>
      <div className="mx-5 mt-4 flex flex-col gap-3">
        {loading ? [...Array(4)].map((_,i)=>(
          <div key={i} className="card animate-pulse flex gap-3 items-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl"/><div className="flex-1"><div className="h-4 bg-gray-100 rounded w-1/2 mb-2"/><div className="h-3 bg-gray-100 rounded w-1/3"/></div>
          </div>
        )) : customers.length===0 ? (
          <div className="text-center py-16"><p className="text-5xl mb-3">👥</p><p className="font-semibold text-gray-500">{search?"No results":"No customers yet"}</p>
            {!search && <button onClick={()=>setShowAdd(true)} className="mt-4 text-kgreen-700 font-semibold text-sm">Add first customer →</button>}</div>
        ) : customers.map(c=>(
          <div key={c._id} className="card flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-kgreen-700 flex items-center justify-center flex-shrink-0">
              <span className="font-display font-bold text-white text-sm">{initials(c.name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{c.name}</p>
              <p className="text-sm text-gray-400 truncate">{c.phone}</p>
            </div>
            <div className="flex gap-2">
              <a href={"https://wa.me/"+c.phone.replace(/[^\d+]/g,"")} target="_blank" rel="noreferrer"
                 className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center active:scale-90">
                <span className="text-xl">💬</span>
              </a>
              <button onClick={()=>handleDelete(c._id,c.name)} className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center active:scale-90">
                <span className="text-lg">🗑️</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      {showAdd && <AddModal onClose={()=>setShowAdd(false)} onAdded={c=>setCustomers(prev=>[c,...prev])}/>}
    </div>
  );
}
