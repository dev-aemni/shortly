require("dotenv").config();
const express    = require("express");
const mongoose   = require("mongoose");
const path       = require("path");
const rateLimit  = require("express-rate-limit");
const Url        = require("./models/Url");
const urlRoutes  = require("./routes/url");

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Rate Limiters ────────────────────────────────────────────────────────────
// General API limiter: 60 req / 1 min per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." },
});

// Strict limiter for the create endpoint: 10 req / 1 min per IP
const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many links created. Please wait a minute." },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));           // reject oversized bodies
app.use(express.static(path.join(__dirname, "../frontend")));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/create",  createLimiter);             // strict limit on creation
app.use("/api/shorten", createLimiter);             // same for legacy alias
app.use("/api",         apiLimiter, urlRoutes);     // general limit on stats/qr/etc

// ─── Redirect Route ───────────────────────────────────────────────────────────
// GET /:code — look up short code, track analytics, redirect
app.get("/:code", async (req, res) => {
  const { code } = req.params;

  // Skip files (favicon.ico etc.)
  if (code.includes(".")) return res.status(404).send("Not found.");

  try {
    const doc = await Url.findOne({ shortCode: code });

    if (!doc) {
      return res.status(404).sendFile(path.join(__dirname, "../frontend/index.html"));
    }

    // ── Disabled link ─────────────────────────────────────────────
    if (!doc.isActive) {
      return res.status(403).sendFile(path.join(__dirname, "../frontend/index.html"));
    }

    // ── Expired link ──────────────────────────────────────────────
    if (doc.expiresAt && doc.expiresAt < new Date()) {
      return res.status(410).sendFile(path.join(__dirname, "../frontend/index.html"));
    }

    // ── Track analytics (non-blocking) ───────────────────────────
    const ua       = req.headers["user-agent"] || "";
    const referrer = req.headers["referer"] || req.headers["referrer"] || "direct";

    const deviceType = parseDevice(ua);
    const browser    = parseBrowser(ua);

    doc.clicks       += 1;
    doc.lastClickedAt = new Date();

    // Keep only the last 500 click events to cap document size
    if (doc.analytics.length >= 500) doc.analytics.shift();
    doc.analytics.push({ referrer, userAgent: ua, deviceType, browser });

    doc.save().catch((err) => console.error("Analytics save error:", err));

    return res.redirect(doc.originalUrl);
  } catch (err) {
    console.error("Redirect error:", err);
    return res.status(500).send("Server error.");
  }
});

// ─── Utility parsers (duplicated here so server.js is self-contained) ─────────
function parseDevice(ua = "") {
  if (/tablet|ipad|playbook|silk/i.test(ua))    return "tablet";
  if (/mobile|iphone|ipod|android|blackberry/i.test(ua)) return "mobile";
  if (ua.length > 0)                             return "desktop";
  return "unknown";
}
function parseBrowser(ua = "") {
  if (/Edg\//i.test(ua))     return "Edge";
  if (/OPR\//i.test(ua))     return "Opera";
  if (/Chrome\//i.test(ua))  return "Chrome";
  if (/Safari\//i.test(ua))  return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/MSIE|Trident/i.test(ua)) return "IE";
  return "unknown";
}

// ─── MongoDB Connection ───────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`🚀 Shortly running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
