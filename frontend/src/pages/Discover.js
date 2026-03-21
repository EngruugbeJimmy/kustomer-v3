import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "/api";

const CATEGORIES = [
  { id:"All",               emoji:"🛍️" },
  { id:"Food & Grocery",    emoji:"🍞" },
  { id:"Fashion",           emoji:"👗" },
  { id:"Beauty & Health",   emoji:"💄" },
  { id:"Electronics",       emoji:"📱" },
  { id:"Home & Living",     emoji:"🏠" },
  { id:"Agriculture",       emoji:"🌾" },
  { id:"Phones & Accessories",emoji:"📲" },
  { id:"Baby & Kids",       emoji:"👶" },
  { id:"Automotive",        emoji:"🚗" },
  { id:"Services",          emoji:"🛠️" },
  { id:"General",           emoji:"🏪" },
];

const PLAN_RANK = { reseller:3, pro:2, starter:1, free:0 };
const PLAN_BADGE = { reseller:"Reseller", pro:"Pro", starter:"Starter" };
const PLAN_BADGE_COLOR = { reseller:"bg-purple-50 text-purple-700", pro:"bg-kgold-50 text-kgold-700", starter:"bg-kgreen-50 text-kgreen-700" };

function ShopCard({ shop, onClick }) {
  const initials = shop.name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
  const colors = ["bg-kgreen-700","bg-amber-500","bg-purple-600","bg-blue-600","bg-red-500","bg-teal-600"];
  const color  = colors[shop.name?.charCodeAt(0) % colors.length];
  const badge  = PLAN_BADGE[shop.plan];


  const reportShop = async (shopSlug) => {
    const reason = window.prompt(
      "Why are you reporting this shop?\n\n" +
      "Type one of:\n fake_shop\n scam\n impersonation\n wrong_info\n other"
    );
    if (!reason) return;
    try {
      await api.post("/verify/report-shop", { shopSlug, reason: reason.trim().toLowerCase() });
      toast.success("Report submitted. Thank you for keeping Kustomer safe.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Report failed");
    }
  };

  return (
    <button onClick={onClick}
      className="w-full card flex items-center gap-3 text-left active:scale-98 transition-all active:bg-kgreen-50">
      <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center flex-shrink-0`}>
        {shop.shopLogoUrl
          ? <img src={shop.shopLogoUrl} alt={shop.name} className="w-full h-full object-cover rounded-2xl"/>
          : <span className="text-white font-bold text-sm">{initials}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-bold text-gray-800 text-sm">{shop.name}</p>
          {badge && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PLAN_BADGE_COLOR[shop.plan]}`}>{badge}</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">{shop.category}</span>
          {shop.city && <><span className="text-gray-200">·</span><span className="text-xs text-gray-400">📍 {shop.city}</span></>}
        </div>
        {shop.shopDescription && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{shop.shopDescription}</p>}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-kgreen-700 font-semibold">{shop.productCount || 0} products</span>
          {shop.orderCount > 0 && <><span className="text-gray-200">·</span><span className="text-xs text-amber-600">🔥 {shop.orderCount} orders</span></>}
        </div>
      </div>
      <span className="text-gray-300 text-xl flex-shrink-0">›</span>
    </button>
  );
}

function ProductCard({ product, onShopClick }) {

  const reportShop = async (shopSlug) => {
    const reason = window.prompt(
      "Why are you reporting this shop?\n\n" +
      "Type one of:\n fake_shop\n scam\n impersonation\n wrong_info\n other"
    );
    if (!reason) return;
    try {
      await api.post("/verify/report-shop", { shopSlug, reason: reason.trim().toLowerCase() });
      toast.success("Report submitted. Thank you for keeping Kustomer safe.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Report failed");
    }
  };

  return (
    <button onClick={() => onShopClick(product.shop?.shopSlug)}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 active:scale-95 transition-all text-left">
      <div className="w-full h-24 bg-gray-50 flex items-center justify-center">
        {product.imageUrl
          ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy"/>
          : <span style={{ fontSize:32 }}>🛒</span>}
      </div>
      <div className="p-2.5">
        <p className="font-bold text-gray-800 text-xs line-clamp-2 leading-tight mb-1">{product.name}</p>
        {product.shop && <p className="text-xs text-gray-400 truncate mb-1">{product.shop.name}</p>}
        <p className="font-bold text-kgreen-700 text-sm">{product.currency}{Number(product.price).toLocaleString()}</p>
      </div>
    </button>
  );
}

export default function Discover() {
  const navigate                      = useNavigate();
  const [sp]                          = useSearchParams();
  const [query, setQuery]             = useState(sp.get("q") || "");
  const [activeCategory, setCategory] = useState("All");
  const [shops, setShops]             = useState([]);
  const [trending, setTrending]       = useState([]);
  const [featured, setFeatured]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searching, setSearching]     = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef                      = useRef(null);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL + "/discover/trending");
      setTrending(res.data.trending || []);
      setFeatured(res.data.featured || []);
    } catch (err) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrending(); }, [fetchTrending]);

  const doSearch = useCallback(async (q, cat) => {
    setSearching(true); setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (q?.trim())              params.set("q", q.trim());
      if (cat && cat !== "All")   params.set("category", cat);
      const res = await axios.get(API_URL + "/discover/search?" + params.toString());
      setShops(res.data.shops || []);
      setTrending(res.data.products || []);
    } catch (err) {}
    finally { setSearching(false); }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (!query.trim() && activeCategory === "All") { setHasSearched(false); fetchTrending(); return; }
    const t = setTimeout(() => doSearch(query, activeCategory), 400);
  
  const reportShop = async (shopSlug) => {
    const reason = window.prompt(
      "Why are you reporting this shop?\n\n" +
      "Type one of:\n fake_shop\n scam\n impersonation\n wrong_info\n other"
    );
    if (!reason) return;
    try {
      await api.post("/verify/report-shop", { shopSlug, reason: reason.trim().toLowerCase() });
      toast.success("Report submitted. Thank you for keeping Kustomer safe.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Report failed");
    }
  };

  return () => clearTimeout(t);
  }, [query, activeCategory, doSearch, fetchTrending]);

  const visitShop = (shopSlug) => {
    window.open("/shop/" + shopSlug, "_blank");
  };


  const reportShop = async (shopSlug) => {
    const reason = window.prompt(
      "Why are you reporting this shop?\n\n" +
      "Type one of:\n fake_shop\n scam\n impersonation\n wrong_info\n other"
    );
    if (!reason) return;
    try {
      await api.post("/verify/report-shop", { shopSlug, reason: reason.trim().toLowerCase() });
      toast.success("Report submitted. Thank you for keeping Kustomer safe.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Report failed");
    }
  };

  return (
    <div className="page pb-24">

      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-4 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Discover</h1>
            <p className="text-kgreen-100 text-xs mt-0.5">Find shops and products across Nigeria</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="bg-kgreen-800 rounded-2xl flex items-center gap-3 px-4 py-3 mb-3">
          <span style={{ fontSize:16 }}>🔍</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search shops, products, cities..."
            className="flex-1 bg-transparent text-white text-sm placeholder-kgreen-100/40 outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(""); setHasSearched(false); fetchTrending(); }}
              className="text-kgreen-100/60 text-sm active:text-white">✕</button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex-shrink-0 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all
                ${activeCategory === cat.id
                  ? "bg-kgold-500 text-kgold-700"
                  : "bg-kgreen-800 text-kgreen-100"}`}>
              <span style={{ fontSize:12 }}>{cat.emoji}</span>
              <span>{cat.id}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-5 mt-4">

        {/* Loading skeleton */}
        {(loading || searching) && (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_,i) => (
              <div key={i} className="card animate-pulse flex gap-3 items-center h-20">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex-shrink-0"/>
                <div className="flex-1"><div className="h-3 bg-gray-100 rounded w-2/3 mb-2"/><div className="h-2 bg-gray-100 rounded w-1/2"/></div>
              </div>
            ))}
          </div>
        )}

        {/* Search results */}
        {!loading && !searching && hasSearched && (
          <>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              {shops.length > 0 ? shops.length + " shop" + (shops.length > 1 ? "s" : "") + " found" : "No shops found"}
              {query && ` for "${query}"`}
            </p>

            {shops.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-semibold text-gray-600">No shops found</p>
                <p className="text-sm text-gray-400 mt-1">Try a different search or category</p>
                <button onClick={() => { setQuery(""); setCategory("All"); setHasSearched(false); fetchTrending(); }}
                  className="mt-4 text-kgreen-700 font-semibold text-sm">See all shops →</button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {shops.map(shop => (
                <div key={shop._id}>
                  <ShopCard shop={shop} onClick={() => visitShop(shop.shopSlug)}/>
                  {/* Product previews from this shop if product search */}
                  {shop.sampleProducts?.length > 0 && (
                    <div className="flex gap-2 mt-2 ml-2 overflow-x-auto pb-1">
                      {shop.sampleProducts.map(p => (
                        <div key={p._id} onClick={() => visitShop(shop.shopSlug)}
                          className="flex-shrink-0 bg-white rounded-xl border border-gray-100 p-2 cursor-pointer active:scale-95 flex items-center gap-2">
                          <div className="w-10 h-10 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                            {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-lg">📦</div>}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-700 line-clamp-1 max-w-[100px]">{p.name}</p>
                            <p className="text-xs font-bold text-kgreen-700">{p.currency}{Number(p.price).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Default — not searching */}
        {!loading && !searching && !hasSearched && (
          <>
            {/* Featured shops */}
            {featured.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Featured Shops</p>
                <div className="flex flex-col gap-3">
                  {featured.map(shop => (
                    <ShopCard key={shop._id} shop={shop} onClick={() => visitShop(shop.shopSlug)}/>
                  ))}
                </div>
              </div>
            )}

            {/* Trending products */}
            {trending.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Trending Products</p>
                <div className="grid grid-cols-2 gap-3">
                  {trending.slice(0, 8).map((product, i) => (
                    <ProductCard key={product._id || i} product={product}
                      onShopClick={(slug) => slug && visitShop(slug)}/>
                  ))}
                </div>
              </div>
            )}

            {/* Browse by category */}
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Browse by category</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.filter(c => c.id !== "All").map(cat => (
                  <button key={cat.id}
                    onClick={() => { setCategory(cat.id); doSearch("", cat.id); }}
                    className="bg-white rounded-2xl p-3 text-center border border-gray-100 active:scale-95 transition-all active:bg-kgreen-50">
                    <span style={{ fontSize:24 }} className="block mb-1">{cat.emoji}</span>
                    <p className="text-xs font-semibold text-gray-600 leading-tight">{cat.id}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Empty state if no data at all */}
            {featured.length === 0 && trending.length === 0 && (
              <div className="text-center py-16">
                <p className="text-5xl mb-3">🏪</p>
                <p className="font-semibold text-gray-600">No shops yet</p>
                <p className="text-sm text-gray-400 mt-1">Be the first shop on Kustomer!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
