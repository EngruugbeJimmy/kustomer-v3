import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";

function ProductModal({ product, onClose, onSaved }) {
  const editing = !!product;
  const [form, setForm]         = useState({ name:product?.name||"", description:product?.description||"", price:product?.price||"", currency:product?.currency||"₦", inStock:product?.inStock!==false });
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview]   = useState(product?.imageUrl||"");
  const [loading, setLoading]   = useState(false);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) { toast.error("Max 5MB"); return; }
    setImageFile(file); setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price || isNaN(form.price)) { toast.error("Name and valid price required"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => fd.append(k, v));
      if (imageFile) fd.append("image", imageFile);
      const hdrs = { "Content-Type": "multipart/form-data" };
      if (editing) { const r = await api.patch("/products/"+product._id, fd, { headers:hdrs }); onSaved(r.data.product,"update"); }
      else         { const r = await api.post("/products", fd, { headers:hdrs });               onSaved(r.data.product,"add"); }
      toast.success(editing ? "Updated!" : "Product added! 📦");
      onClose();
    } catch (err) { toast.error(err.response?.data?.error||"Save failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-28 overflow-y-auto max-h-[92vh]" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white pt-4 pb-3 z-10 border-b border-gray-50">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-3"/>
          <h2 className="font-display text-xl font-bold text-center">{editing?"Edit Product":"Add New Product"}</h2>
        </div>
        <div className="pt-4">
          <label className="block mb-4 cursor-pointer">
            {preview ? (
              <div className="relative w-full h-40">
                <img src={preview} alt="preview" className="w-full h-40 object-cover rounded-2xl border-2 border-kgreen-100"/>
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">Tap to change</div>
              </div>
            ) : (
              <div className="w-full h-32 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2">
                <span className="text-3xl">📷</span>
                <span className="text-sm text-gray-400 font-medium">Tap to add photo</span>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleImage} className="hidden"/>
          </label>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Name *</label>
              <input type="text" placeholder="e.g. Fresh White Bread" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="input" autoFocus/>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Description</label>
              <input type="text" placeholder="e.g. Freshly baked, large loaf" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="input"/>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Currency</label>
                <select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})} className="input py-3">
                  {["₦","KSh","GH₵","R","$","€"].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-semibold text-gray-500 mb-1.5 block">Price *</label>
                <input type="number" inputMode="decimal" placeholder="0.00" min="0" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} className="input"/>
              </div>
            </div>
            <div className="card flex items-center justify-between py-3">
              <div>
                <p className="font-semibold text-gray-700 text-sm">In Stock</p>
                <p className="text-xs text-gray-400">Hidden from catalog when off</p>
              </div>
              <button type="button" onClick={()=>setForm({...form,inStock:!form.inStock})}
                className={`w-12 h-6 rounded-full transition-colors ${form.inStock?"bg-kgreen-700":"bg-gray-200"}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.inStock?"translate-x-6":"translate-x-0.5"}`}/>
              </button>
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-100 sticky bottom-0 bg-white pb-2">
              <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
              <button type="submit" className="btn-green" disabled={loading}>{loading?"⏳ Saving...":editing?"Save Changes":"Add Product"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const [sp] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(sp.get("add")==="true");
  const [editP, setEditP]       = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/products"); setProducts(r.data.products); }
    catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ fetch(); },[fetch]);

  const handleSaved = (p,t) => {
    if (t==="add") setProducts(prev=>[p,...prev]);
    else setProducts(prev=>prev.map(x=>x._id===p._id?p:x));
    setEditP(null);
  };
  const handleDelete = async (id, name) => {
    if (!window.confirm("Delete "+name+"?")) return;
    try { await api.delete("/products/"+id); setProducts(prev=>prev.filter(p=>p._id!==id)); toast.success("Deleted"); }
    catch { toast.error("Failed"); }
  };
  const handleToggle = async (p) => {
    try { const r = await api.patch("/products/"+p._id, { inStock: !p.inStock }); setProducts(prev=>prev.map(x=>x._id===r.data.product._id?r.data.product:x)); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="page pb-24">
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <div className="flex items-center justify-between">
          <div><h1 className="font-display text-2xl font-bold text-white">Products</h1>
            <p className="text-kgreen-100 text-xs mt-0.5">{products.filter(p=>p.inStock).length} in stock · {products.filter(p=>!p.inStock).length} out of stock</p></div>
          <button onClick={()=>{setEditP(null);setShowModal(true);}}
            className="bg-kgold-500 text-kgold-700 font-bold text-sm px-4 py-2 rounded-xl active:scale-95 shadow-lg">
            + Add
          </button>
        </div>
      </div>
      <div className="mx-5 mt-4 flex flex-col gap-3">
        {loading ? [...Array(3)].map((_,i)=>(
          <div key={i} className="card animate-pulse flex gap-3"><div className="w-20 h-20 bg-gray-100 rounded-xl"/><div className="flex-1"><div className="h-4 bg-gray-100 rounded w-1/2 mb-2"/><div className="h-3 bg-gray-100 rounded w-1/3"/></div></div>
        )) : products.length===0 ? (
          <div className="text-center py-16"><p className="text-5xl mb-3">📦</p><p className="font-semibold text-gray-500">No products yet</p>
            <button onClick={()=>setShowModal(true)} className="mt-4 text-kgreen-700 font-semibold text-sm">Add first product →</button></div>
        ) : products.map(p=>(
          <div key={p._id} className="card flex gap-3 items-start">
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100">
              {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy"/> : <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <p className="font-semibold text-gray-800 text-sm leading-tight">{p.name}</p>
                <span className={p.inStock?"badge-green":"badge-red"}>{p.inStock?"In stock":"Out"}</span>
              </div>
              {p.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>}
              <p className="font-display font-bold text-kgreen-700 mt-1">{p.currency}{Number(p.price).toLocaleString()}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={()=>handleToggle(p)} className="text-xs bg-gray-100 text-gray-600 font-semibold px-3 py-1.5 rounded-lg active:scale-95">{p.inStock?"Mark out":"Mark in"}</button>
                <button onClick={()=>{setEditP(p);setShowModal(true);}} className="text-xs bg-kgreen-50 text-kgreen-700 font-semibold px-3 py-1.5 rounded-lg active:scale-95">Edit</button>
                <button onClick={()=>handleDelete(p._id,p.name)} className="text-xs bg-red-50 text-red-500 font-semibold px-3 py-1.5 rounded-lg active:scale-95">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showModal && <ProductModal product={editP} onClose={()=>{setShowModal(false);setEditP(null);}} onSaved={handleSaved}/>}
    </div>
  );
}
