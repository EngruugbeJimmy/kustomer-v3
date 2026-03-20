import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";

const TAG_CONFIG = {
  hot:     { label:"🔥 Hot buyer",  bg:"bg-amber-50",  tc:"text-amber-700",  border:"border-amber-200" },
  buyer:   { label:"✅ Buyer",      bg:"bg-kgreen-50", tc:"text-kgreen-700", border:"border-kgreen-200" },
  clicker: { label:"👁 Clicked",    bg:"bg-blue-50",   tc:"text-blue-700",   border:"border-blue-200" },
  ghost:   { label:"👻 Ghost",      bg:"bg-gray-100",  tc:"text-gray-500",   border:"border-gray-200" },
  new:     { label:"🆕 New",        bg:"bg-purple-50", tc:"text-purple-600", border:"border-purple-200" },
};

const TAG_FILTERS = [
  { key:"all",     label:"All",         emoji:"👥" },
  { key:"hot",     label:"Hot buyers",  emoji:"🔥" },
  { key:"buyer",   label:"Buyers",      emoji:"✅" },
  { key:"clicker", label:"Clickers",    emoji:"👁" },
  { key:"ghost",   label:"Ghosts",      emoji:"👻" },
];

function AddModal({ onClose, onAdded }) {
  const [form, setForm]       = useState({ name:"", phone:"", email:"", notes:"" });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { toast.error("Name and phone required"); return; }
    setLoading(true);
    try {
      const r = await api.post("/customers", form);
      toast.success("Customer added! ✅");
      onAdded(r.data.customer); onClose();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5"/>
        <h2 className="font-display text-xl font-bold mb-5">Add Customer</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">Full Name *</label>
            <input type="text" placeholder="e.g. Chidi Okeke" value={form.name} onChange={e => setForm({...form, name:e.target.value})} className="input" autoFocus/></div>
          <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">WhatsApp Number *</label>
            <input type="tel" inputMode="tel" placeholder="+234 800 000 0000" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} className="input"/>
            <p className="text-xs text-gray-300 mt-1">Include country code e.g. +234</p></div>
          <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">Email (optional)</label>
            <input type="email" placeholder="for email campaigns" value={form.email} onChange={e => setForm({...form, email:e.target.value})} className="input"/></div>
          <div><label className="text-sm font-semibold text-gray-500 mb-1.5 block">Notes (optional)</label>
            <input type="text" placeholder="e.g. Buys bread daily" value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} className="input"/></div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="submit" className="btn-green" disabled={loading}>{loading ? "⏳ Saving..." : "Add Customer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerProfile({ customer, onClose, onConfirmOrder }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/analytics/customer/" + customer._id)
      .then(r => setData(r.data))
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [customer._id]);

  const tag = TAG_CONFIG[customer.buyerTag] || TAG_CONFIG.new;
  const initials = customer.name.split(" ").map(x => x[0]).join("").toUpperCase().slice(0,2);
  const avatarColors = { hot:"bg-amber-500", buyer:"bg-kgreen-700", clicker:"bg-blue-500", ghost:"bg-gray-400", new:"bg-purple-500" };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl pb-10 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-5"/>

        {/* Profile header */}
        <div className="text-center px-6 mb-4">
          <div className={`w-14 h-14 ${avatarColors[customer.buyerTag] || "bg-gray-400"} rounded-2xl flex items-center justify-center font-display font-bold text-xl text-white mx-auto mb-3`}>
            {initials}
          </div>
          <h2 className="font-display font-bold text-xl text-gray-900">{customer.name}</h2>
          <p className="text-gray-400 text-sm mt-0.5">{customer.phone}</p>
          <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${tag.bg} ${tag.tc}`}>{tag.label}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mx-6 mb-4">
          {[
            { label:"Orders", value: customer.totalOrders || 0, color:"text-kgreen-700" },
            { label:"Spent", value: customer.totalSpent > 0 ? "₦" + Math.round(customer.totalSpent / 1000) + "K" : "—", color:"text-kgold-700" },
            { label:"Visits", value: customer.catalogVisits || 0, color:"text-blue-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 rounded-2xl p-3 text-center">
              <p className={`font-display font-bold text-xl ${color}`}>{value}</p>
              <p className="text-gray-400 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Insight for clickers and ghosts */}
        {customer.buyerTag === "clicker" && (
          <div className="mx-6 mb-4 bg-blue-50 border border-blue-100 rounded-2xl p-3">
            <p className="text-xs font-bold text-blue-700 mb-1">👁 Browsing but not buying</p>
            <p className="text-xs text-blue-600">This customer opened your catalog {customer.catalogVisits} time{customer.catalogVisits !== 1 ? "s" : ""} but hasn't ordered yet. Try sending them a special offer or discount.</p>
          </div>
        )}
        {customer.buyerTag === "ghost" && (
          <div className="mx-6 mb-4 bg-gray-50 border border-gray-200 rounded-2xl p-3">
            <p className="text-xs font-bold text-gray-600 mb-1">👻 Never engaged</p>
            <p className="text-xs text-gray-500">This number has received {customer.broadcastsReceived} broadcast{customer.broadcastsReceived !== 1 ? "s" : ""} but never opened your catalog. Consider removing them to save credits.</p>
          </div>
        )}

        {/* Order history */}
        {!loading && data?.orders?.length > 0 && (
          <div className="mx-6 mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Purchase History</p>
            <div className="flex flex-col gap-2">
              {data.orders.map(order => (
                <div key={order._id} className="bg-white rounded-2xl p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${order.status === "confirmed" ? "bg-kgreen-50 text-kgreen-700" : "bg-amber-50 text-amber-700"}`}>
                        {order.status === "confirmed" ? "✓ Confirmed" : "⏳ Pending"}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{order.orderType}</span>
                    </div>
                    <span className="font-bold text-kgreen-700 text-sm">{order.currency}{(order.total || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {(order.items || []).slice(0,3).map((item, i) => (
                      <p key={i} className="text-xs text-gray-500">· {item.name} x{item.qty}</p>
                    ))}
                  </div>
                  <p className="text-xs text-gray-300 mt-1.5">{new Date(order.createdAt).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mx-6 grid grid-cols-2 gap-3">
          <a href={"https://wa.me/" + customer.phone.replace(/[^\d+]/g,"")}
            target="_blank" rel="noreferrer"
            className="bg-green-500 text-white font-bold text-sm py-3 rounded-2xl text-center active:scale-95">
            💬 Message
          </a>
          <button onClick={onClose} className="bg-gray-100 text-gray-600 font-bold text-sm py-3 rounded-2xl active:scale-95">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const [sp]                          = useSearchParams();
  const navigate                      = useNavigate();
  const [customers, setCustomers]     = useState([]);
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState("all");
  const [loading, setLoading]         = useState(true);
  const [showAdd, setShowAdd]         = useState(sp.get("add") === "true");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [stats, setStats]             = useState(null);

  const fetchData = useCallback(async (q = "", tag = "all") => {
    setLoading(true);
    try {
      const params = {};
      if (q.trim()) params.search = q.trim();
      if (tag !== "all") params.tag = tag;
      params.sort = "totalOrders";
      const [cr, sr] = await Promise.all([
        api.get("/analytics/customers", { params }),
        api.get("/analytics/dashboard"),
      ]);
      setCustomers(cr.data.customers);
      setStats(sr.data.customers);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const t = setTimeout(() => fetchData(search, filter), 400);
    return () => clearTimeout(t);
  }, [search, filter, fetchData]);

  const handleDelete = async (id, name) => {
    if (!window.confirm("Remove " + name + "?")) return;
    try {
      await api.delete("/customers/" + id);
      setCustomers(prev => prev.filter(c => c._id !== id));
      toast.success("Removed");
    } catch { toast.error("Failed"); }
  };

  const initials = n => n.split(" ").map(x => x[0]).join("").toUpperCase().slice(0,2);
  const avatarColors = { hot:"bg-amber-500", buyer:"bg-kgreen-700", clicker:"bg-blue-500", ghost:"bg-gray-300", new:"bg-purple-500" };

  return (
    <div className="page pb-24">
      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Customers</h1>
            <p className="text-kgreen-100 text-xs mt-0.5">{customers.length} shown</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate("/orders")}
              className="bg-kgold-500 text-kgold-700 text-xs font-bold px-3 py-2 rounded-xl active:scale-95">
              📋 Orders
            </button>
            <button onClick={() => setShowAdd(true)}
              className="bg-white text-kgreen-700 text-xs font-bold px-3 py-2 rounded-xl active:scale-95">
              + Add
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-base">🔍</span>
          <input type="search" placeholder="Search name or phone..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-kgreen-800 text-white border-0 rounded-2xl px-4 py-3 pl-10 text-sm placeholder-kgreen-100/40 focus:outline-none"/>
        </div>

        {/* Buyer tag filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TAG_FILTERS.map(({ key, label, emoji }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl transition-all
                ${filter === key ? "bg-kgold-500 text-kgold-700" : "bg-kgreen-800 text-kgreen-100"}`}>
              {emoji} {label}
              {stats && key !== "all" && (
                <span className="ml-1 opacity-70">({stats[key] || 0})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="mx-5 mt-4 grid grid-cols-4 gap-2">
          {[
            { key:"hot",     emoji:"🔥", color:"text-amber-600" },
            { key:"buyer",   emoji:"✅", color:"text-kgreen-700" },
            { key:"clicker", emoji:"👁", color:"text-blue-600" },
            { key:"ghost",   emoji:"👻", color:"text-gray-400" },
          ].map(({ key, emoji, color }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`bg-white rounded-2xl p-3 text-center border transition-all
                ${filter === key ? "border-kgreen-700" : "border-gray-100"}`}>
              <p className={`font-display font-bold text-xl ${color}`}>{stats[key + "s"] ?? stats[key] ?? 0}</p>
              <p className="text-gray-400 text-[9px] mt-0.5">{emoji} {key}</p>
            </button>
          ))}
        </div>
      )}

      {/* Customer list */}
      <div className="mx-5 mt-4 flex flex-col gap-2">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse flex gap-3 items-center h-16 bg-gray-50"/>
          ))
        ) : customers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">{filter !== "all" ? TAG_CONFIG[filter]?.label.split(" ")[0] : "👥"}</p>
            <p className="font-semibold text-gray-500">
              {filter !== "all" ? "No " + filter + " customers yet" : search ? "No results" : "No customers yet"}
            </p>
            {filter === "all" && !search && (
              <button onClick={() => setShowAdd(true)} className="mt-4 text-kgreen-700 font-semibold text-sm">
                Add first customer →
              </button>
            )}
          </div>
        ) : customers.map(c => {
          const tag = TAG_CONFIG[c.buyerTag] || TAG_CONFIG.new;
          return (
            <div key={c._id}
              onClick={() => setSelectedCustomer(c)}
              className="card flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer">
              <div className={`w-12 h-12 rounded-2xl ${avatarColors[c.buyerTag] || "bg-gray-400"} flex items-center justify-center flex-shrink-0`}>
                <span className="font-display font-bold text-white text-sm">{initials(c.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tag.bg} ${tag.tc}`}>{tag.label}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-xs text-gray-400">{c.phone}</p>
                  {c.totalOrders > 0 && <p className="text-xs text-kgreen-700 font-semibold">{c.totalOrders} order{c.totalOrders !== 1 ? "s" : ""}</p>}
                  {c.totalSpent > 0 && <p className="text-xs text-kgold-700 font-semibold">₦{Math.round(c.totalSpent / 1000)}K spent</p>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a href={"https://wa.me/" + c.phone.replace(/[^\d+]/g, "")}
                  target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center active:scale-90">
                  <span style={{ fontSize:16 }}>💬</span>
                </a>
                <button onClick={e => { e.stopPropagation(); handleDelete(c._id, c.name); }}
                  className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center active:scale-90">
                  <span style={{ fontSize:14 }}>🗑️</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdded={c => setCustomers(prev => [c, ...prev])}/>}
      {selectedCustomer && <CustomerProfile customer={selectedCustomer} onClose={() => setSelectedCustomer(null)}/>}
    </div>
  );
}
