import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../utils/api";

export default function Orders() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/analytics/pending-orders");
      setOrders(r.data.orders || []);
    } catch { toast.error("Failed to load orders"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleAction = async (orderId, action) => {
    setActing(orderId);
    try {
      const r = await api.post("/analytics/confirm-order", { orderId, action });
      toast.success(r.data.message);
      setOrders(prev => prev.filter(o => o._id !== orderId));
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setActing(null); }
  };

  const TAG_COLOR = {
    hot:     "bg-amber-50 text-amber-700",
    buyer:   "bg-kgreen-50 text-kgreen-700",
    clicker: "bg-blue-50 text-blue-700",
    ghost:   "bg-gray-100 text-gray-500",
    new:     "bg-purple-50 text-purple-600",
  };

  const timeAgo = (date) => {
    const mins = Math.floor((Date.now() - new Date(date)) / 60000);
    if (mins < 1)  return "Just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return hrs + "h ago";
    return Math.floor(hrs / 24) + "d ago";
  };

  return (
    <div className="page pb-24">
      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-6 rounded-b-[2rem]">
        <h1 className="font-display text-2xl font-bold text-white mb-1">WhatsApp Orders</h1>
        <p className="text-kgreen-100 text-sm">Confirm orders to track your real buyers</p>
      </div>

      <div className="mx-5 mt-4">
        {/* Explainer */}
        <div className="card bg-amber-50 border-amber-100 flex items-start gap-3 mb-4 py-3">
          <span style={{ fontSize:20 }}>💡</span>
          <p className="text-xs text-amber-700 leading-relaxed">
            When a customer places an order via your catalog, it appears here. Tap <strong>"Mark as sold"</strong> after they pay to record the sale, update their buyer tag, and track your real revenue.
          </p>
        </div>

        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="card animate-pulse h-28 bg-gray-50 mb-3"/>)
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">📭</p>
            <p className="font-semibold text-gray-500">No pending orders</p>
            <p className="text-xs text-gray-400 mt-1">Orders from your catalog will appear here when customers place them</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map(order => {
              const customer = order.customer;
              const tagCls   = TAG_COLOR[customer?.buyerTag] || TAG_COLOR.new;
              const initials = customer?.name?.split(" ").map(x => x[0]).join("").toUpperCase().slice(0,2) || "?";
              const isActing = acting === order._id;

              return (
                <div key={order._id} className="card">
                  {/* Customer row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-kgreen-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-white text-sm">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800 text-sm">{customer?.name || "Unknown customer"}</p>
                        {customer?.buyerTag && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagCls}`}>
                            {customer.buyerTag === "hot" ? "🔥 Hot" : customer.buyerTag === "buyer" ? "✅ Buyer" : customer.buyerTag === "clicker" ? "👁 Clicker" : customer.buyerTag === "ghost" ? "👻 Ghost" : "🆕 New"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{customer?.phone} · {timeAgo(order.createdAt)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-display font-bold text-kgreen-700 text-lg">
                        {order.currency}{(order.total || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{order.orderType}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="bg-gray-50 rounded-xl p-3 mb-3">
                    {(order.items || []).map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <p className="text-xs text-gray-700">
                          <span className="font-semibold">{item.name}</span>
                          <span className="text-gray-400"> × {item.qty}</span>
                        </p>
                        <p className="text-xs font-semibold text-gray-700">
                          {item.currency || order.currency}{((item.price || 0) * (item.qty || 1)).toLocaleString()}
                        </p>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between">
                      <p className="text-xs font-bold text-gray-700">Total</p>
                      <p className="text-xs font-bold text-kgreen-700">{order.currency}{(order.total || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleAction(order._id, "cancelled")}
                      disabled={isActing}
                      className="bg-gray-100 text-gray-600 font-bold text-sm py-3 rounded-xl active:scale-95 transition-all">
                      ✕ Not sold
                    </button>
                    <button onClick={() => handleAction(order._id, "confirmed")}
                      disabled={isActing}
                      className="bg-kgreen-700 text-white font-bold text-sm py-3 rounded-xl active:scale-95 transition-all shadow-lg">
                      {isActing ? "⏳..." : "✅ Mark as sold"}
                    </button>
                  </div>

                  {/* Chat link */}
                  <a href={"https://wa.me/" + (customer?.phone || "").replace(/[^\d+]/g, "")}
                    target="_blank" rel="noreferrer"
                    className="mt-2 block text-center text-xs text-green-600 font-semibold">
                    💬 Open WhatsApp chat with {customer?.name?.split(" ")[0] || "customer"} →
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
