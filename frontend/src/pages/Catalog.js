import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { buildOrderMessage } from "../utils/whatsapp";
import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL || "/api";

export default function Catalog() {
  const { shopSlug }              = useParams();
  const [shop, setShop]           = useState(null);
  const [products, setProducts]   = useState([]);
  const [cart, setCart]           = useState({});
  const [orderType, setOrderType] = useState("pickup");
  const [customerName, setCustomerName] = useState("");
  const [step, setStep]           = useState("browse");
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);

  useEffect(()=>{
    (async()=>{
      try { const r=await axios.get(API_URL+"/catalog/"+shopSlug); setShop(r.data.shop); setProducts(r.data.products); }
      catch(err) { if(err.response?.status===404) setNotFound(true); }
      finally { setLoading(false); }
    })();
  },[shopSlug]);

  const addToCart  = p => setCart(prev=>({...prev,[p._id]:(prev[p._id]||0)+1}));
  const removeFromCart = id => setCart(prev=>{ const n={...prev}; n[id]>1?n[id]--:delete n[id]; return n; });
  const cartItems  = products.filter(p=>cart[p._id]).map(p=>({...p,qty:cart[p._id]}));
  const cartTotal  = cartItems.reduce((s,i)=>s+i.price*i.qty,0);
  const cartCount  = Object.values(cart).reduce((s,v)=>s+v,0);
  const currency   = products[0]?.currency||"₦";

  const handleOrder = () => {
    if(!cartItems.length||!shop?.phone) return;
    buildOrderMessage({ shopPhone:shop.phone, shopName:shop.name, items:cartItems, orderType, customerName });
  };

  if (loading) return (
    <div className="min-h-screen bg-kgreen-700 flex items-center justify-center">
      <div className="text-center"><p className="text-5xl mb-3 animate-bounce">🛍️</p><p className="text-kgreen-100">Loading shop...</p></div>
    </div>
  );
  if (notFound) return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center px-6">
      <div className="text-center"><p className="text-6xl mb-4">🏪</p><h1 className="font-display text-xl font-bold text-gray-800 mb-2">Shop not found</h1><p className="text-gray-400 text-sm">Ask the seller for their new link.</p></div>
    </div>
  );

  if (step==="browse") return (
    <div className="min-h-screen bg-[#f0f2f5] max-w-md mx-auto pb-28">
      {/* Shop header */}
      <div className="bg-kgreen-700 px-5 pt-10 pb-5 rounded-b-[2rem]">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-14 h-14 bg-kgold-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            {shop.shopLogoUrl ? <img src={shop.shopLogoUrl} alt={shop.name} className="w-full h-full object-cover rounded-2xl"/> : <span className="text-2xl">🛍️</span>}
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">{shop.name}</h1>
            <p className="text-kgreen-100 text-xs mt-0.5">{shop.shopDescription}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-kgreen-50 text-kgreen-700 text-xs font-bold px-2.5 py-1 rounded-full">✓ Open</span>
          <span className="text-kgreen-100 text-xs">{products.length} item{products.length!==1?"s":""} available</span>
        </div>
      </div>
      {products.length===0 ? (
        <div className="text-center py-20 px-6"><p className="text-5xl mb-3">📦</p><p className="font-semibold text-gray-500">No products right now</p><p className="text-sm text-gray-400 mt-1">Check back soon!</p></div>
      ) : (
        <div className="px-4 pt-5">
          <p className="font-display font-bold text-gray-800 mb-3 px-1">Our Products</p>
          <div className="grid grid-cols-2 gap-3">
            {products.map(p=>{
              const qty=cart[p._id]||0;
              return (
                <div key={p._id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                  <div className="w-full h-36 bg-gray-50">
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy"/> : <div className="w-full h-full flex items-center justify-center"><span className="text-5xl opacity-20">🛒</span></div>}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-gray-800 text-sm line-clamp-2 leading-tight">{p.name}</p>
                    {p.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>}
                    <p className="font-display font-bold text-kgreen-700 mt-1">{p.currency}{Number(p.price).toLocaleString()}</p>
                    {qty===0 ? (
                      <button onClick={()=>addToCart(p)} className="mt-2 w-full bg-kgreen-700 text-white text-sm font-semibold py-2 rounded-xl active:scale-95 transition-all">Add to cart</button>
                    ) : (
                      <div className="mt-2 flex items-center justify-between bg-kgreen-50 rounded-xl p-1 border border-kgreen-100">
                        <button onClick={()=>removeFromCart(p._id)} className="w-8 h-8 bg-white rounded-lg font-bold text-kgreen-700 active:scale-90 text-lg shadow-sm">−</button>
                        <span className="font-bold text-kgreen-700 text-sm">{qty}</span>
                        <button onClick={()=>addToCart(p)} className="w-8 h-8 bg-kgreen-700 rounded-lg font-bold text-white active:scale-90 text-lg">+</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {cartCount>0 && (
        <div className="fixed bottom-6 left-0 right-0 max-w-md mx-auto px-5 z-50">
          <button onClick={()=>setStep("cart")} className="w-full bg-kgreen-700 text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 shadow-xl">
            <div className="bg-white/20 text-white text-sm font-bold w-7 h-7 rounded-lg flex items-center justify-center">{cartCount}</div>
            <span>View Cart</span>
            <span className="font-display font-bold">{currency}{cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  );

  if (step==="cart") return (
    <div className="min-h-screen bg-[#f0f2f5] max-w-md mx-auto pb-28">
      <div className="bg-kgreen-700 px-5 pt-10 pb-5 rounded-b-[2rem]">
        <div className="flex items-center gap-3">
          <button onClick={()=>setStep("browse")} className="w-10 h-10 bg-kgreen-800 rounded-xl flex items-center justify-center active:scale-95 text-white text-lg">←</button>
          <div><h1 className="font-display text-xl font-bold text-white">Your Cart</h1><p className="text-kgreen-100 text-xs">{cartCount} item{cartCount!==1?"s":""}</p></div>
        </div>
      </div>
      <div className="mx-5 mt-4 flex flex-col gap-3">
        {cartItems.map(item=>(
          <div key={item._id} className="card flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50">
              {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
              <p className="text-xs text-gray-400">{item.currency}{Number(item.price).toLocaleString()} each</p>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={()=>removeFromCart(item._id)} className="w-7 h-7 bg-gray-100 rounded-lg font-bold text-gray-600 active:scale-90 text-sm">−</button>
                <span className="font-bold text-gray-800 text-sm w-6 text-center">{item.qty}</span>
                <button onClick={()=>addToCart(item)} className="w-7 h-7 bg-kgreen-700 rounded-lg font-bold text-white active:scale-90 text-sm">+</button>
              </div>
            </div>
            <p className="font-display font-bold text-kgreen-700 flex-shrink-0">{item.currency}{(item.price*item.qty).toLocaleString()}</p>
          </div>
        ))}
        <div className="card bg-kgreen-50 border-kgreen-100 flex justify-between items-center py-4">
          <span className="font-display font-bold text-gray-800">Total</span>
          <span className="font-display font-bold text-kgreen-700 text-2xl">{currency}{cartTotal.toLocaleString()}</span>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Order Type</p>
          <div className="grid grid-cols-2 gap-3">
            {[{key:"pickup",emoji:"🏪",label:"Pickup",sub:"Come to shop"},
              {key:"delivery",emoji:"🚚",label:"Pay on Delivery",sub:"Deliver to me"}].map(opt=>(
              <button key={opt.key} onClick={()=>setOrderType(opt.key)}
                className={`card flex flex-col items-center gap-1 py-4 border-2 active:scale-95 transition-all
                            ${orderType===opt.key?"border-kgreen-700 bg-kgreen-50":"border-gray-100"}`}>
                <span className="text-3xl">{opt.emoji}</span>
                <span className={`font-semibold text-sm ${orderType===opt.key?"text-kgreen-700":"text-gray-700"}`}>{opt.label}</span>
                <span className="text-xs text-gray-400">{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Your name (optional)</label>
          <input type="text" placeholder="e.g. Amaka" value={customerName} onChange={e=>setCustomerName(e.target.value)} className="input"/>
        </div>
        <button onClick={handleOrder} className="btn-green flex items-center justify-center gap-2">
          <span className="text-xl">💬</span><span>Send Order via WhatsApp</span>
        </button>
        <p className="text-center text-xs text-gray-400">Opens WhatsApp with your order pre-filled to {shop.name}</p>
      </div>
    </div>
  );
  return null;
}
