import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { buildOrderMessage } from "../utils/whatsapp";

const API_URL = process.env.REACT_APP_API_URL || "/api";

// ── Customer capture modal ────────────────────────────────────
function CustomerModal({ shop, cartItems, orderType, onClose, onConfirm }) {
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const handleConfirm = async () => {
    if (!name.trim())  { setError("Please enter your name"); return; }
    if (!phone.trim()) { setError("Please enter your WhatsApp number"); return; }
    if (phone.trim().length < 7) { setError("Please enter a valid number"); return; }
    setSaving(true);
    try {
      // Save customer to shop's list silently in background
      axios.post(API_URL + "/catalog/" + shop.shopSlug + "/customer", {
        name:  name.trim(),
        phone: phone.trim()
      }).catch(() => {}); // Never block the order if this fails

      // Ping order count for discovery ranking
      axios.post(API_URL + "/discover/order-ping", { shopSlug: shop.shopSlug }).catch(() => {});

      onConfirm({ customerName: name.trim(), customerPhone: phone.trim() });
    } finally {
      setSaving(false);
    }
  };

  const currency = cartItems[0]?.currency || "₦";
  const total    = cartItems.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div style={{ minHeight:480, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div className="bg-white w-full max-w-md rounded-t-3xl px-6 pt-5 pb-10">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5"/>

        {/* Order summary */}
        <div className="bg-kgreen-50 border border-kgreen-100 rounded-2xl p-4 mb-5">
          <p className="text-xs font-bold text-kgreen-700 uppercase tracking-wide mb-2">Your order from {shop.name}</p>
          {cartItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between mb-1">
              <p className="text-sm text-gray-700">{item.name} × {item.qty}</p>
              <p className="text-sm font-semibold text-kgreen-700">{item.currency}{(item.price * item.qty).toLocaleString()}</p>
            </div>
          ))}
          <div className="flex justify-between pt-2 mt-2 border-t border-kgreen-100">
            <p className="font-bold text-gray-800 text-sm">Total</p>
            <p className="font-bold text-kgreen-700">{currency}{total.toLocaleString()}</p>
          </div>
          <p className="text-xs text-gray-400 mt-2">{orderType === "pickup" ? "🏪 Pickup from shop" : "🚚 Pay on delivery"}</p>
        </div>

        <h2 className="font-display text-xl font-bold text-gray-900 mb-1">Almost done!</h2>
        <p className="text-sm text-gray-500 mb-5">Enter your details so <span className="font-semibold text-gray-700">{shop.name}</span> knows who is ordering.</p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Your Name *</label>
            <input
              type="text"
              placeholder="e.g. Chidi Okeke"
              value={name}
              onChange={e => { setName(e.target.value); setError(""); }}
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Your WhatsApp Number *</label>
            <input
              type="tel"
              inputMode="tel"
              placeholder="+234 800 000 0000"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(""); }}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">Include country code e.g. +234 for Nigeria</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs text-red-600 font-semibold">{error}</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2">
            <span style={{ fontSize:14, flexShrink:0 }}>🔒</span>
            <p className="text-xs text-gray-500 leading-relaxed">
              Your details are saved to {shop.name}'s customer list so they can send you updates about new products and offers. You can ask them to remove you at any time.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-outline flex-1 py-3 text-sm">Cancel</button>
            <button onClick={handleConfirm} disabled={saving}
              className="btn-green flex-1 flex items-center justify-center gap-2">
              <span style={{ fontSize:16 }}>💬</span>
              <span>{saving ? "Opening..." : "Send on WhatsApp"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Catalog() {
  const { shopSlug }              = useParams();
  const [shop, setShop]           = useState(null);
  const [products, setProducts]   = useState([]);
  const [cart, setCart]           = useState({});
  const [orderType, setOrderType] = useState("pickup");
  const [step, setStep]           = useState("browse");
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(API_URL + "/catalog/" + shopSlug);
        setShop(r.data.shop);
        setProducts(r.data.products);
      } catch (err) {
        if (err.response?.status === 404) setNotFound(true);
      } finally { setLoading(false); }
    })();
  }, [shopSlug]);

  const addToCart    = p => setCart(prev => ({ ...prev, [p._id]: (prev[p._id] || 0) + 1 }));
  const removeFromCart = id => setCart(prev => { const n = { ...prev }; n[id] > 1 ? n[id]-- : delete n[id]; return n; });
  const cartItems    = products.filter(p => cart[p._id]).map(p => ({ ...p, qty: cart[p._id] }));
  const cartTotal    = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount    = Object.values(cart).reduce((s, v) => s + v, 0);
  const currency     = products[0]?.currency || "₦";

  const handleOrderConfirm = ({ customerName, customerPhone }) => {
    setShowModal(false);
    buildOrderMessage({
      shopPhone:    shop.phone,
      shopName:     shop.name,
      items:        cartItems,
      orderType,
      customerName,
      customerPhone,
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-kgreen-700 flex items-center justify-center">
      <div className="text-center">
        <p className="text-5xl mb-3 animate-bounce">🛍️</p>
        <p className="text-kgreen-100">Loading shop...</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-6xl mb-4">🏪</p>
        <h1 className="font-display text-xl font-bold text-gray-800 mb-2">Shop not found</h1>
        <p className="text-gray-400 text-sm">Ask the seller for their new link.</p>
      </div>
    </div>
  );

  // ── Modal overlay ─────────────────────────────────────────
  if (showModal) return (
    <div className="min-h-screen max-w-md mx-auto bg-[#f0f2f5]">
      <CustomerModal
        shop={shop}
        cartItems={cartItems}
        orderType={orderType}
        onClose={() => setShowModal(false)}
        onConfirm={handleOrderConfirm}
      />
    </div>
  );

  // ── Browse screen ─────────────────────────────────────────
  if (step === "browse") return (
    <div className="min-h-screen bg-[#f0f2f5] max-w-md mx-auto pb-28">
      {/* Shop header */}
      <div className="bg-kgreen-700 px-5 pt-10 pb-5 rounded-b-[2rem]">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-14 h-14 bg-kgold-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            {shop.shopLogoUrl
              ? <img src={shop.shopLogoUrl} alt={shop.name} className="w-full h-full object-cover rounded-2xl"/>
              : <span className="text-2xl">🛍️</span>}
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">{shop.name}</h1>
            <p className="text-kgreen-100 text-xs mt-0.5">{shop.shopDescription}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-kgreen-50 text-kgreen-700 text-xs font-bold px-2.5 py-1 rounded-full">✓ Open</span>
          <span className="text-kgreen-100 text-xs">{products.length} item{products.length !== 1 ? "s" : ""} available</span>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 px-6">
          <p className="text-5xl mb-3">📦</p>
          <p className="font-semibold text-gray-500">No products right now</p>
          <p className="text-sm text-gray-400 mt-1">Check back soon!</p>
        </div>
      ) : (
        <div className="px-4 pt-5">
          <p className="font-display font-bold text-gray-800 mb-3 px-1">Our Products</p>
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => {
              const qty = cart[p._id] || 0;
              return (
                <div key={p._id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                  <div className="w-full h-36 bg-gray-50">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy"/>
                      : <div className="w-full h-full flex items-center justify-center"><span className="text-5xl opacity-20">🛒</span></div>}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-gray-800 text-sm line-clamp-2 leading-tight">{p.name}</p>
                    {p.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>}
                    <p className="font-display font-bold text-kgreen-700 mt-1">{p.currency}{Number(p.price).toLocaleString()}</p>
                    {qty === 0 ? (
                      <button onClick={() => addToCart(p)}
                        className="mt-2 w-full bg-kgreen-700 text-white text-sm font-semibold py-2 rounded-xl active:scale-95 transition-all">
                        Add to cart
                      </button>
                    ) : (
                      <div className="mt-2 flex items-center justify-between bg-kgreen-50 rounded-xl p-1 border border-kgreen-100">
                        <button onClick={() => removeFromCart(p._id)}
                          className="w-8 h-8 bg-white rounded-lg font-bold text-kgreen-700 active:scale-90 text-lg shadow-sm">−</button>
                        <span className="font-bold text-kgreen-700 text-sm">{qty}</span>
                        <button onClick={() => addToCart(p)}
                          className="w-8 h-8 bg-kgreen-700 rounded-lg font-bold text-white active:scale-90 text-lg">+</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 max-w-md mx-auto px-5 z-50">
          <button onClick={() => setStep("cart")}
            className="w-full bg-kgreen-700 text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 shadow-xl">
            <div className="bg-white/20 text-white text-sm font-bold w-7 h-7 rounded-lg flex items-center justify-center">{cartCount}</div>
            <span>View Cart</span>
            <span className="font-display font-bold">{currency}{cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  );

  // ── Cart screen ───────────────────────────────────────────
  if (step === "cart") return (
    <div className="min-h-screen bg-[#f0f2f5] max-w-md mx-auto pb-28">
      <div className="bg-kgreen-700 px-5 pt-10 pb-5 rounded-b-[2rem]">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep("browse")}
            className="w-10 h-10 bg-kgreen-800 rounded-xl flex items-center justify-center active:scale-95 text-white text-lg">←</button>
          <div>
            <h1 className="font-display text-xl font-bold text-white">Your Cart</h1>
            <p className="text-kgreen-100 text-xs">{cartCount} item{cartCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      <div className="mx-5 mt-4 flex flex-col gap-3">
        {cartItems.map(item => (
          <div key={item._id} className="card flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50">
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover"/>
                : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
              <p className="text-xs text-gray-400">{item.currency}{Number(item.price).toLocaleString()} each</p>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => removeFromCart(item._id)}
                  className="w-7 h-7 bg-gray-100 rounded-lg font-bold text-gray-600 active:scale-90 text-sm">−</button>
                <span className="font-bold text-gray-800 text-sm w-6 text-center">{item.qty}</span>
                <button onClick={() => addToCart(item)}
                  className="w-7 h-7 bg-kgreen-700 rounded-lg font-bold text-white active:scale-90 text-sm">+</button>
              </div>
            </div>
            <p className="font-display font-bold text-kgreen-700 flex-shrink-0">
              {item.currency}{(item.price * item.qty).toLocaleString()}
            </p>
          </div>
        ))}

        <div className="card bg-kgreen-50 border-kgreen-100 flex justify-between items-center py-4">
          <span className="font-display font-bold text-gray-800">Total</span>
          <span className="font-display font-bold text-kgreen-700 text-2xl">{currency}{cartTotal.toLocaleString()}</span>
        </div>

        {/* Order type */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Order Type</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key:"pickup",   emoji:"🏪", label:"Pickup",           sub:"Come to shop" },
              { key:"delivery", emoji:"🚚", label:"Pay on Delivery",  sub:"Deliver to me" },
            ].map(opt => (
              <button key={opt.key} onClick={() => setOrderType(opt.key)}
                className={`card flex flex-col items-center gap-1 py-4 border-2 active:scale-95 transition-all
                  ${orderType === opt.key ? "border-kgreen-700 bg-kgreen-50" : "border-gray-100"}`}>
                <span className="text-3xl">{opt.emoji}</span>
                <span className={`font-semibold text-sm ${orderType === opt.key ? "text-kgreen-700" : "text-gray-700"}`}>{opt.label}</span>
                <span className="text-xs text-gray-400">{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* The key change — this button now opens the customer capture modal */}
        <button onClick={() => setShowModal(true)}
          className="btn-green flex items-center justify-center gap-2">
          <span style={{ fontSize:18 }}>💬</span>
          <span>Place Order via WhatsApp</span>
        </button>
        <p className="text-center text-xs text-gray-400">
          We'll ask for your name and number before opening WhatsApp
        </p>
      </div>
    </div>
  );

  return null;
}
