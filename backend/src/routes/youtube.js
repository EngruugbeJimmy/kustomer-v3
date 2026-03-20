const express  = require("express");
const axios    = require("axios");
const path     = require("path");
const fs       = require("fs");
const { google }  = require("googleapis");
const VideoJob = require("../models/VideoJob");
const User     = require("../models/User");
const Product  = require("../models/Product");
const auth     = require("../middleware/auth");
const router   = express.Router();

const APP_URL  = process.env.APP_URL || "http://localhost:5000";
const videoDir = path.join(__dirname, "../../temp/videos");
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

// ── OAuth client ───────────────────────────────────────────────
const getOAuthClient = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || APP_URL + "/api/youtube/oauth/callback"
);

// ── GET /api/youtube/status ────────────────────────────────────
router.get("/status", auth, async (req, res) => {
  try {
    const jobs = await VideoJob.find({ owner: req.user._id })
      .sort({ createdAt: -1 }).limit(10).lean();
    res.json({
      connected:    req.user.youtubeConnected,
      channelName:  req.user.youtubeChannelName,
      channelId:    req.user.youtubeChannelId,
      videoCredits: req.user.videoCredits || 0,
      plan:         req.user.plan,
      canUseYoutube: req.user.plan === "business",
      jobs,
    });
  } catch { res.status(500).json({ error: "Failed" }); }
});

// ── GET /api/youtube/oauth/url ─────────────────────────────────
router.get("/oauth/url", auth, (req, res) => {
  if (req.user.plan !== "business")
    return res.status(402).json({ error: "YouTube publishing requires Business plan" });
  const oauth2 = getOAuthClient();
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly"
    ],
    state: req.user._id.toString(),
    prompt: "consent"
  });
  res.json({ url });
});

// ── GET /api/youtube/oauth/callback ───────────────────────────
router.get("/oauth/callback", async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    if (!code || !userId) return res.redirect(process.env.FRONTEND_URL + "/youtube?error=oauth_failed");
    const oauth2 = getOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);
    // Get channel info
    const yt = google.youtube({ version: "v3", auth: oauth2 });
    const ch = await yt.channels.list({ part: "snippet", mine: true });
    const channel = ch.data.items?.[0];
    await User.findByIdAndUpdate(userId, {
      youtubeConnected:    true,
      youtubeAccessToken:  tokens.access_token,
      youtubeRefreshToken: tokens.refresh_token || "",
      youtubeChannelId:    channel?.id || "",
      youtubeChannelName:  channel?.snippet?.title || "",
      youtubeTokenExpiry:  tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    });
    res.redirect(process.env.FRONTEND_URL + "/youtube?connected=true");
  } catch (e) {
    res.redirect(process.env.FRONTEND_URL + "/youtube?error=" + encodeURIComponent(e.message));
  }
});

// ── POST /api/youtube/disconnect ──────────────────────────────
router.post("/disconnect", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      youtubeConnected:false, youtubeAccessToken:"", youtubeRefreshToken:"",
      youtubeChannelId:"", youtubeChannelName:"", youtubeTokenExpiry:null
    });
    res.json({ message: "YouTube disconnected" });
  } catch { res.status(500).json({ error: "Failed" }); }
});

// ── POST /api/youtube/generate ────────────────────────────────
// Step 1: Generate script + metadata with AI
router.post("/generate", auth, async (req, res) => {
  try {
    if (req.user.plan !== "business")
      return res.status(402).json({ error: "YouTube requires Business plan" });
    if ((req.user.videoCredits || 0) < 1)
      return res.status(402).json({ error: "No video credits left. Buy more in Plans." });

    const { productId, prompt, voiceStyle } = req.body;
    if (!productId) return res.status(400).json({ error: "Product required" });

    const product = await Product.findOne({ _id: productId, owner: req.user._id });
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Create job
    const job = await VideoJob.create({
      owner:        req.user._id,
      product:      product._id,
      productName:  product.name,
      productImage: product.imageUrl || "",
      productPrice: product.currency + product.price.toLocaleString(),
      prompt:       prompt || "",
      voiceStyle:   voiceStyle || "friendly",
      status:       "generating",
    });

    // Generate script + metadata with Claude API
    const aiPrompt = `You are a Nigerian social media video scriptwriter for small businesses.
Create a compelling 45-second YouTube product video for this shop:

Shop: ${req.user.name}
Product: ${product.name}
Price: ${product.currency}${product.price}
Description: ${product.description || ""}
Shop catalog: ${APP_URL}/shop/${req.user.shopSlug}
Extra instructions: ${prompt || "Make it exciting and Naija flavoured"}
Voice style: ${voiceStyle || "friendly"}

Return ONLY a JSON object (no markdown):
{
  "title": "YouTube video title (max 70 chars, SEO optimised, includes product name)",
  "description": "YouTube description (200-300 chars, includes catalog link at end, has call to action)",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "script": "The spoken voiceover script (45 seconds when read aloud at normal pace = ~120 words). Write it naturally as it would be spoken. Start with a hook. End with clear call to action to click the link below.",
  "slides": [
    {"text": "Hook line (3-5 words)", "duration": 3},
    {"text": "Product name + price", "duration": 3},
    {"text": "Key benefit 1", "duration": 3},
    {"text": "Key benefit 2", "duration": 3},
    {"text": "Call to action", "duration": 4}
  ]
}`;

    const aiRes = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: aiPrompt }]
    }, {
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      }
    });

    const raw   = aiRes.data.content[0]?.text || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const data  = JSON.parse(clean);

    // Update job with AI content
    await VideoJob.findByIdAndUpdate(job._id, {
      script:      data.script || "",
      title:       data.title  || product.name + " | " + req.user.name,
      description: data.description || "",
      tags:        data.tags || [],
      status:      "pending",
    });

    const updated = await VideoJob.findById(job._id);
    res.json({ job: updated, slides: data.slides || [] });

  } catch (e) {
    res.status(500).json({ error: "Script generation failed: " + e.message });
  }
});

// ── POST /api/youtube/render ──────────────────────────────────
// Step 2: Render video using ffmpeg (slideshow + text overlays + voiceover)
router.post("/render/:jobId", auth, async (req, res) => {
  try {
    const job = await VideoJob.findOne({ _id: req.params.jobId, owner: req.user._id });
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (!job.script) return res.status(400).json({ error: "Generate script first" });

    await VideoJob.findByIdAndUpdate(job._id, { status: "rendering" });

    // Generate voiceover using Google TTS (free) or ElevenLabs
    let audioBuffer;
    try {
      if (process.env.ELEVENLABS_API_KEY) {
        // ElevenLabs for premium Nigerian-accented voice
        const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
        const elRes = await axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          { text: job.script, model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
          { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
            responseType: "arraybuffer" }
        );
        audioBuffer = Buffer.from(elRes.data);
      } else {
        // Google TTS fallback (free)
        const ttsRes = await axios.post(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_CLIENT_ID}`,
          {
            input: { text: job.script },
            voice: { languageCode: "en-NG", name: "en-NG-Standard-A" },
            audioConfig: { audioEncoding: "MP3", speakingRate: 1.05, pitch: 1.0 }
          }
        );
        audioBuffer = Buffer.from(ttsRes.data.audioContent, "base64");
      }
    } catch {
      // If TTS fails, create silent audio placeholder
      // In production, always have at least one TTS configured
      audioBuffer = null;
    }

    // Save audio file
    const jobId    = job._id.toString();
    const audioPath = path.join(videoDir, jobId + "_audio.mp3");
    const videoPath = path.join(videoDir, jobId + ".mp4");

    if (audioBuffer) fs.writeFileSync(audioPath, audioBuffer);

    // Build video using FFmpeg
    // Strategy: download product image → create slideshow → overlay text → add audio
    const ffmpeg = require("fluent-ffmpeg");
    const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
    ffmpeg.setFfmpegPath(ffmpegPath);

    // Download product image or use placeholder
    let imagePath = path.join(videoDir, jobId + "_img.jpg");
    if (job.productImage) {
      try {
        const imgRes = await axios.get(job.productImage, { responseType: "arraybuffer" });
        fs.writeFileSync(imagePath, Buffer.from(imgRes.data));
      } catch { imagePath = null; }
    } else { imagePath = null; }

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg();

      // Input: product image (loop for 45 seconds) or black background
      if (imagePath) {
        cmd.input(imagePath).inputOptions(["-loop 1", "-t 45"]);
      } else {
        cmd.input("color=c=black:s=1280x720:d=45").inputOptions(["-f lavfi"]);
      }

      // Add audio if available
      if (audioBuffer && fs.existsSync(audioPath)) {
        cmd.input(audioPath);
      }

      cmd
        .videoFilter([
          // Scale and pad to 1280x720
          "scale=1280:720:force_original_aspect_ratio=decrease",
          "pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black",
          // Add green brand overlay bar at bottom
          "drawbox=x=0:y=640:w=1280:h=80:color=0x0a7a4b@0.9:t=fill",
          // Shop name
          `drawtext=text='${req.user.name.replace(/'/g,"\\'")}':fontsize=28:fontcolor=white:x=(w-text_w)/2:y=655:font=Arial:fontweight=bold`,
          // Product name overlay (centre, large)
          `drawtext=text='${job.productName.replace(/'/g,"\\'")}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=200:font=Arial:fontweight=bold:shadowcolor=black:shadowx=3:shadowy=3`,
          // Price
          `drawtext=text='${job.productPrice}':fontsize=36:fontcolor=#d4a017:x=(w-text_w)/2:y=260:font=Arial:fontweight=bold`,
          // Call to action
          `drawtext=text='Order now — link below':fontsize=24:fontcolor=white:x=(w-text_w)/2:y=560:font=Arial:alpha=0.9`,
          // Ken Burns zoom effect
          "zoompan=z='min(zoom+0.0005,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1350:s=1280x720"
        ])
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 23",
          "-c:a aac",
          "-b:a 128k",
          "-ar 44100",
          "-shortest",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          "-t 45"
        ])
        .output(videoPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // Serve video via static URL
    const videoUrl = APP_URL + "/videos/" + jobId + ".mp4";

    await VideoJob.findByIdAndUpdate(job._id, {
      status:    "done",
      videoPath: videoPath,
      videoUrl:  videoUrl,
      duration:  45,
    });

    // Deduct 1 video credit
    await User.findByIdAndUpdate(req.user._id, { $inc: { videoCredits: -1 } });

    res.json({ videoUrl, jobId: job._id });

  } catch (e) {
    await VideoJob.findByIdAndUpdate(req.params.jobId, { status:"failed", error:e.message });
    res.status(500).json({ error: "Video render failed: " + e.message });
  }
});

// ── POST /api/youtube/publish ─────────────────────────────────
// Step 3: Upload rendered video to YouTube
router.post("/publish/:jobId", auth, async (req, res) => {
  try {
    if (!req.user.youtubeConnected)
      return res.status(400).json({ error: "Connect your YouTube channel first" });

    const job = await VideoJob.findOne({ _id: req.params.jobId, owner: req.user._id });
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.status !== "done" || !job.videoPath)
      return res.status(400).json({ error: "Video not rendered yet" });
    if (!fs.existsSync(job.videoPath))
      return res.status(400).json({ error: "Video file not found. Re-render first." });

    await VideoJob.findByIdAndUpdate(job._id, { status: "uploading" });

    // Refresh OAuth token if expired
    const user = await User.findById(req.user._id);
    const oauth2 = getOAuthClient();
    oauth2.setCredentials({
      access_token:  user.youtubeAccessToken,
      refresh_token: user.youtubeRefreshToken,
    });

    // Auto-refresh if expired
    if (user.youtubeTokenExpiry && new Date() > new Date(user.youtubeTokenExpiry)) {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
      await User.findByIdAndUpdate(user._id, {
        youtubeAccessToken: credentials.access_token,
        youtubeTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null
      });
    }

    const yt = google.youtube({ version: "v3", auth: oauth2 });

    // Upload to YouTube
    const uploadRes = await yt.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title:       job.title || job.productName + " | " + user.name,
          description: (job.description || "") + "\n\n🛒 Order here: " + APP_URL + "/shop/" + user.shopSlug,
          tags:        job.tags || [],
          categoryId:  "26", // Howto & Style — best for product videos
        },
        status: {
          privacyStatus:           req.body.privacy || "public",
          selfDeclaredMadeForKids: false,
        }
      },
      media: {
        body: fs.createReadStream(job.videoPath)
      }
    });

    const youtubeId  = uploadRes.data.id;
    const youtubeUrl = "https://www.youtube.com/watch?v=" + youtubeId;

    await VideoJob.findByIdAndUpdate(job._id, {
      status:      "done",
      youtubeId:   youtubeId,
      youtubeUrl:  youtubeUrl,
      publishedAt: new Date(),
    });

    res.json({ youtubeId, youtubeUrl, message: "Video published to YouTube! 🎉" });

  } catch (e) {
    await VideoJob.findByIdAndUpdate(req.params.jobId, { status:"failed", error:e.message });
    res.status(500).json({ error: "YouTube upload failed: " + e.message });
  }
});

// ── GET /api/youtube/jobs ─────────────────────────────────────
router.get("/jobs", auth, async (req, res) => {
  try {
    const jobs = await VideoJob.find({ owner: req.user._id })
      .sort({ createdAt: -1 }).limit(20)
      .populate("product", "name imageUrl price currency").lean();
    res.json({ jobs });
  } catch { res.status(500).json({ error: "Failed" }); }
});

// ── DELETE /api/youtube/jobs/:jobId ───────────────────────────
router.delete("/jobs/:jobId", auth, async (req, res) => {
  try {
    const job = await VideoJob.findOneAndDelete({ _id: req.params.jobId, owner: req.user._id });
    if (job?.videoPath && fs.existsSync(job.videoPath)) fs.unlinkSync(job.videoPath);
    res.json({ message: "Deleted" });
  } catch { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
