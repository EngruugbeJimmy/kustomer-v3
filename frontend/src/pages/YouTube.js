import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const VOICE_STYLES = [
  { id:"friendly",     label:"Friendly",     desc:"Warm and approachable",   emoji:"😊" },
  { id:"energetic",    label:"Energetic",     desc:"High energy, exciting",   emoji:"🔥" },
  { id:"professional", label:"Professional",  desc:"Calm and trustworthy",    emoji:"💼" },
  { id:"naija",        label:"Naija Vibe",    desc:"Local flavour, relatable",emoji:"🇳🇬" },
];

const STATUS_LABEL = {
  pending:"Ready to render",generating:"Generating script...",
  rendering:"Creating video...",uploading:"Uploading to YouTube...",
  done:"Complete",failed:"Failed"
};
const STATUS_COLOR = {
  pending:"text-gray-400",generating:"text-amber-600",
  rendering:"text-blue-600",uploading:"text-purple-600",
  done:"text-kgreen-700",failed:"text-red-500"
};

export default function YouTube() {
  const { user, refresh }             = useAuth();
  const navigate                      = useNavigate();
  const [sp]                          = useSearchParams();
  const [status, setStatus]           = useState(null);
  const [products, setProducts]       = useState([]);
  const [jobs, setJobs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState("create");

  // Create form
  const [selectedProduct, setSelectedProduct] = useState("");
  const [prompt, setPrompt]           = useState("");
  const [voiceStyle, setVoiceStyle]   = useState("friendly");
  const [generating, setGenerating]   = useState(false);
  const [rendering, setRendering]     = useState(false);
  const [publishing, setPublishing]   = useState(false);
  const [currentJob, setCurrentJob]   = useState(null);
  const [slides, setSlides]           = useState([]);
  const [privacy, setPrivacy]         = useState("public");
  const [step, setStep]               = useState(1);

  const canUse = user?.plan === "business";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, pr] = await Promise.all([
        api.get("/youtube/status"),
        api.get("/products"),
      ]);
      setStatus(sr.data);
      setJobs(sr.data.jobs || []);
      setProducts(pr.data.products || []);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const connected = sp.get("connected");
    const error     = sp.get("error");
    if (connected) { toast.success("YouTube connected! 🎉"); refresh(); fetchAll(); }
    if (error)     toast.error("YouTube connection failed: " + error);
  }, []);

  const connectYouTube = async () => {
    try {
      const res = await api.get("/youtube/oauth/url");
      window.location.href = res.data.url;
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  const disconnectYouTube = async () => {
    if (!window.confirm("Disconnect YouTube?")) return;
    try { await api.post("/youtube/disconnect"); await refresh(); fetchAll(); toast.success("Disconnected"); }
    catch { toast.error("Failed"); }
  };

  // Step 1: Generate script
  const handleGenerate = async () => {
    if (!selectedProduct) { toast.error("Select a product first"); return; }
    setGenerating(true);
    try {
      const res = await api.post("/youtube/generate", {
        productId: selectedProduct, prompt, voiceStyle
      });
      setCurrentJob(res.data.job);
      setSlides(res.data.slides || []);
      setStep(2);
      toast.success("Script generated! ✨");
    } catch (err) { toast.error(err.response?.data?.error || "Generation failed"); }
    finally { setGenerating(false); }
  };

  // Step 2: Render video
  const handleRender = async () => {
    if (!currentJob) return;
    setRendering(true);
    toast("Creating your video... this takes 30–60 seconds ⏳", { duration: 8000 });
    try {
      const res = await api.post("/youtube/render/" + currentJob._id);
      setCurrentJob(prev => ({ ...prev, status:"done", videoUrl:res.data.videoUrl }));
      setStep(3);
      toast.success("Video ready! 🎬");
    } catch (err) { toast.error(err.response?.data?.error || "Render failed"); }
    finally { setRendering(false); }
  };

  // Step 3: Publish to YouTube
  const handlePublish = async () => {
    if (!currentJob || !status?.connected) {
      toast.error("Connect your YouTube channel first");
      return;
    }
    setPublishing(true);
    try {
      const res = await api.post("/youtube/publish/" + currentJob._id, { privacy });
      setCurrentJob(prev => ({ ...prev, youtubeUrl:res.data.youtubeUrl }));
      setStep(4);
      await fetchAll();
      toast.success("Published to YouTube! 🎉");
    } catch (err) { toast.error(err.response?.data?.error || "Upload failed"); }
    finally { setPublishing(false); }
  };

  const resetFlow = () => { setStep(1); setCurrentJob(null); setSlides([]); setPrompt(""); setSelectedProduct(""); };

  const deleteJob = async (jobId) => {
    try { await api.delete("/youtube/jobs/" + jobId); fetchAll(); toast.success("Deleted"); }
    catch { toast.error("Failed"); }
  };

  if (loading) return (
    <div className="page items-center justify-center">
      <div className="text-center"><p className="text-4xl mb-3 animate-bounce">🎬</p><p className="text-gray-400">Loading...</p></div>
    </div>
  );

  return (
    <div className="page pb-28">
      {/* Header */}
      <div className="bg-kgreen-700 px-5 pt-12 pb-5 rounded-b-[2rem]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-2xl">▶️</span>
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">YouTube Studio</h1>
            <p className="text-kgreen-100 text-xs">
              {status?.connected ? "Connected: " + status.channelName : "Not connected"}
              {" · "}{status?.videoCredits || 0} video credits
            </p>
          </div>
        </div>
        <div className="flex bg-kgreen-800 rounded-2xl p-1 gap-1">
          {[["create","🎬 Create"],["library","📚 Library"]].map(([key,lbl]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all
                ${tab===key ? "bg-red-500 text-white" : "text-kgreen-100"}`}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Not on Business plan */}
      {!canUse && (
        <div className="mx-5 mt-5">
          <div className="card border-red-100 bg-red-50 text-center py-8">
            <p className="text-5xl mb-3">🎬</p>
            <p className="font-display font-bold text-gray-800 text-lg mb-2">YouTube Studio</p>
            <p className="text-sm text-gray-500 mb-1">Generate product videos and publish to YouTube directly from Kustomer</p>
            <p className="text-xs text-gray-400 mb-5">Requires Business plan — ₦15,000/month</p>
            <button onClick={() => navigate("/billing")} className="btn-green">Upgrade to Business</button>
          </div>
          <div className="mt-4 card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">What you get</p>
            {[
              ["🤖","AI writes a 45-second product video script from your prompt"],
              ["🎙️","Nigerian-accented voiceover generated automatically"],
              ["🎬","Product slideshow video created — no editing skills needed"],
              ["📤","Published directly to your YouTube channel in one tap"],
              ["🔍","Auto-generated SEO title, description and tags"],
              ["🛒","Catalog link embedded in every video description"],
              ["💳","10 video credits per month included"],
            ].map(([icon,text]) => (
              <div key={text} className="flex items-start gap-3 mb-3 last:mb-0">
                <span className="text-lg flex-shrink-0">{icon}</span>
                <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content — Business plan users */}
      {canUse && tab === "create" && (
        <div className="mx-5 mt-4 flex flex-col gap-4">

          {/* YouTube connection status */}
          <div className={`card flex items-center gap-3 ${status?.connected ? "border-kgreen-100 bg-kgreen-50" : "border-red-100 bg-red-50"}`}>
            <span className="text-2xl">{status?.connected ? "✅" : "🔗"}</span>
            <div className="flex-1">
              <p className={`font-bold text-sm ${status?.connected ? "text-kgreen-700" : "text-red-600"}`}>
                {status?.connected ? "YouTube Connected" : "Connect YouTube Channel"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {status?.connected ? status.channelName + " · " + (status.videoCredits||0) + " credits left" : "Required before publishing videos"}
              </p>
            </div>
            {status?.connected ? (
              <button onClick={disconnectYouTube} className="text-xs bg-red-50 text-red-500 font-bold px-3 py-1.5 rounded-lg">Disconnect</button>
            ) : (
              <button onClick={connectYouTube} className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95">Connect</button>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[1,2,3,4].map(n => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0
                  ${step >= n ? "bg-kgreen-700 text-white" : "bg-gray-100 text-gray-400"}`}>{n}</div>
                {n < 4 && <div className={`flex-1 h-0.5 ${step > n ? "bg-kgreen-700" : "bg-gray-100"}`}/>}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 font-medium -mt-2">
            <span>Script</span><span>Preview</span><span>Publish</span><span>Done</span>
          </div>

          {/* STEP 1: Create */}
          {step === 1 && (
            <>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Select Product *</p>
                <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="input py-3">
                  <option value="">Choose a product...</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name} — {p.currency}{Number(p.price).toLocaleString()}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Video Direction (optional)</p>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2}
                  placeholder="e.g. Make it exciting, show how fresh the bread is, target Lagos market, add urgency..."
                  className="input resize-none text-sm" maxLength={300}/>
                <p className="text-xs text-gray-300 mt-1">Leave blank for a great default Naija-style video</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Voice Style</p>
                <div className="grid grid-cols-2 gap-2">
                  {VOICE_STYLES.map(v => (
                    <button key={v.id} onClick={() => setVoiceStyle(v.id)}
                      className={`card flex items-center gap-3 py-3 border-2 active:scale-95 transition-all text-left
                        ${voiceStyle === v.id ? "border-kgreen-700 bg-kgreen-50" : "border-gray-100"}`}>
                      <span className="text-xl">{v.emoji}</span>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{v.label}</p>
                        <p className="text-xs text-gray-400">{v.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="card bg-amber-50 border-amber-100 flex items-start gap-3 py-3">
                <span className="text-lg">⚡</span>
                <p className="text-xs text-amber-700">Uses 1 video credit ({status?.videoCredits||0} remaining). Each credit generates + renders one 45-second product video.</p>
              </div>
              <button onClick={handleGenerate} disabled={generating || !selectedProduct}
                className="btn-green flex items-center justify-center gap-2">
                {generating ? "✨ Generating script..." : "✨ Generate Video Script"}
              </button>
            </>
          )}

          {/* STEP 2: Preview script + render */}
          {step === 2 && currentJob && (
            <>
              <div className="card border-kgreen-100 bg-kgreen-50">
                <p className="text-xs font-bold text-kgreen-700 uppercase tracking-wide mb-2">✨ AI Generated Title</p>
                <p className="font-bold text-gray-800 text-sm">{currentJob.title}</p>
              </div>
              <div className="card">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">📝 Video Script (voiceover)</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{currentJob.script}</p>
              </div>
              {slides.length > 0 && (
                <div className="card">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">🎬 Slide Sequence</p>
                  <div className="flex flex-col gap-2">
                    {slides.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                        <div className="w-8 h-8 bg-kgreen-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{i+1}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 text-sm">{s.text}</p>
                        </div>
                        <span className="text-xs text-gray-400">{s.duration}s</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="card">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">🏷️ YouTube Tags</p>
                <div className="flex flex-wrap gap-2">
                  {(currentJob.tags || []).map(tag => (
                    <span key={tag} className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={resetFlow} className="btn-outline flex-1 py-3">← Start over</button>
                <button onClick={handleRender} disabled={rendering} className="btn-green flex-1">
                  {rendering ? "🎬 Creating video..." : "🎬 Create Video"}
                </button>
              </div>
              {rendering && (
                <div className="card bg-blue-50 border-blue-100 text-center py-4">
                  <p className="text-3xl mb-2 animate-bounce">🎬</p>
                  <p className="font-semibold text-blue-700 text-sm">Rendering your video...</p>
                  <p className="text-xs text-blue-500 mt-1">This takes 30–60 seconds. Please wait.</p>
                  <div className="bg-blue-100 rounded-full h-2 mt-3 overflow-hidden">
                    <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width:"60%" }}/>
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 3: Publish */}
          {step === 3 && currentJob && (
            <>
              {currentJob.videoUrl && (
                <div className="card">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">🎬 Your Video Preview</p>
                  <video src={currentJob.videoUrl} controls className="w-full rounded-xl" style={{ maxHeight: 200 }}/>
                  <a href={currentJob.videoUrl} target="_blank" rel="noreferrer"
                    className="text-kgreen-700 text-xs font-semibold mt-2 block text-center">
                    Open full video →
                  </a>
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Privacy Setting</p>
                <div className="grid grid-cols-3 gap-2">
                  {[["public","🌍 Public","Everyone can see"],["unlisted","🔗 Unlisted","Only with link"],["private","🔒 Private","Only you"]].map(([val,lbl,desc]) => (
                    <button key={val} onClick={() => setPrivacy(val)}
                      className={`card text-center py-3 border-2 active:scale-95 transition-all
                        ${privacy === val ? "border-kgreen-700 bg-kgreen-50" : "border-gray-100"}`}>
                      <p className="text-sm font-bold text-gray-800">{lbl}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              {!status?.connected && (
                <div className="card bg-red-50 border-red-100 text-center py-4">
                  <p className="font-bold text-red-600 text-sm mb-2">Connect YouTube first</p>
                  <button onClick={connectYouTube} className="bg-red-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl active:scale-95">Connect YouTube</button>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-outline flex-1 py-3">← Back</button>
                <button onClick={handlePublish} disabled={publishing || !status?.connected}
                  className="btn-green flex-1 bg-red-500 hover:bg-red-600 flex items-center justify-center gap-2">
                  {publishing ? "⏳ Uploading..." : "▶️ Publish to YouTube"}
                </button>
              </div>
            </>
          )}

          {/* STEP 4: Done */}
          {step === 4 && currentJob && (
            <div className="card text-center py-8">
              <p className="text-5xl mb-3">🎉</p>
              <p className="font-display font-bold text-gray-800 text-xl mb-2">Published!</p>
              {currentJob.youtubeUrl && (
                <>
                  <p className="text-sm text-gray-500 mb-4">Your product video is live on YouTube</p>
                  <a href={currentJob.youtubeUrl} target="_blank" rel="noreferrer"
                    className="bg-red-500 text-white font-bold text-sm px-6 py-3 rounded-2xl inline-block active:scale-95 mb-4">
                    ▶️ Watch on YouTube
                  </a>
                  <p className="text-xs text-gray-400">Shop link is in the video description — every viewer can order directly</p>
                </>
              )}
              <button onClick={resetFlow} className="mt-4 btn-outline">Create another video →</button>
            </div>
          )}
        </div>
      )}

      {/* Library tab */}
      {canUse && tab === "library" && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {jobs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-3">🎬</p>
              <p className="font-semibold text-gray-500">No videos yet</p>
              <button onClick={() => setTab("create")} className="mt-4 text-kgreen-700 font-semibold text-sm">Create first video →</button>
            </div>
          ) : jobs.map(job => (
            <div key={job._id} className="card">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                  {job.productImage ? <img src={job.productImage} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">{job.title || job.productName}</p>
                  <p className={`text-xs font-semibold mt-1 ${STATUS_COLOR[job.status]}`}>{STATUS_LABEL[job.status]}</p>
                </div>
                <button onClick={() => deleteJob(job._id)} className="text-gray-300 text-sm active:text-red-400">✕</button>
              </div>
              <div className="flex gap-2">
                {job.videoUrl && (
                  <a href={job.videoUrl} target="_blank" rel="noreferrer"
                    className="flex-1 bg-gray-100 text-gray-600 font-bold text-xs py-2.5 rounded-xl text-center active:scale-95">
                    🎬 Preview
                  </a>
                )}
                {job.youtubeUrl && (
                  <a href={job.youtubeUrl} target="_blank" rel="noreferrer"
                    className="flex-1 bg-red-500 text-white font-bold text-xs py-2.5 rounded-xl text-center active:scale-95">
                    ▶️ YouTube
                  </a>
                )}
                {job.status === "done" && !job.youtubeUrl && status?.connected && (
                  <button onClick={async () => { setCurrentJob(job); setStep(3); setTab("create"); }}
                    className="flex-1 bg-kgreen-700 text-white font-bold text-xs py-2.5 rounded-xl active:scale-95">
                    📤 Publish
                  </button>
                )}
              </div>
              {job.publishedAt && (
                <p className="text-xs text-gray-300 mt-2 text-right">Published {new Date(job.publishedAt).toLocaleDateString()}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
