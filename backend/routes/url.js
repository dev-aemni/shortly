const express = require("express");
const router  = express.Router();
const { nanoid } = require("nanoid");
const QRCode  = require("qrcode");
const Url     = require("../models/Url");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

// Validate custom slug: 2-50 chars, letters/numbers/hyphens only
function isValidSlug(slug) {
  return /^[a-zA-Z0-9-]{2,50}$/.test(slug);
}

// Derive simple device type from User-Agent string
function parseDevice(ua = "") {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return "mobile";
  if (ua.length > 0) return "desktop";
  return "unknown";
}

// Derive browser name from User-Agent string
function parseBrowser(ua = "") {
  if (/Edg\//i.test(ua))    return "Edge";
  if (/OPR\//i.test(ua))    return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/MSIE|Trident/i.test(ua)) return "IE";
  return "unknown";
}

// ─── POST /api/create ─────────────────────────────────────────────────────────
// Create a shortened URL (with optional custom slug + expiry)
router.post("/create", async (req, res) => {
  let { url, customSlug, expiresIn } = req.body;

  // ── URL validation ────────────────────────────────────────────
  if (!url || url.trim() === "") {
    return res.status(400).json({ error: "URL is required." });
  }
  url = url.trim();
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: "Invalid URL. Must start with http:// or https://" });
  }

  // Block localhost / private IPs (spam protection)
  try {
    const hostname = new URL(url).hostname;
    if (/^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) {
      return res.status(400).json({ error: "Private/local URLs are not allowed." });
    }
  } catch { /* already validated above */ }

  // ── Slug handling ─────────────────────────────────────────────
  let shortCode;
  let isCustom = false;

  if (customSlug && customSlug.trim() !== "") {
    customSlug = customSlug.trim().toLowerCase();

    if (!isValidSlug(customSlug)) {
      return res.status(400).json({
        error: "Custom slug must be 2–50 characters (letters, numbers, hyphens only).",
      });
    }

    // Check collision
    const existing = await Url.findOne({ shortCode: customSlug });
    if (existing) {
      return res.status(409).json({
        error: "This URL is already taken, use a different one.",
      });
    }

    shortCode = customSlug;
    isCustom  = true;
  } else {
    // Auto-generate unique 7-char code (retry on unlikely collision)
    let attempts = 0;
    do {
      shortCode = nanoid(7);
      attempts++;
      if (attempts > 5) return res.status(500).json({ error: "Could not generate unique code." });
    } while (await Url.exists({ shortCode }));
  }

  // ── Expiry ────────────────────────────────────────────────────
  let expiresAt = null;
  if (expiresIn) {
    const days = parseInt(expiresIn, 10);
    if (!isNaN(days) && days > 0) {
      expiresAt = new Date(Date.now() + days * 864e5);
    }
  }

  // ── Save ──────────────────────────────────────────────────────
  try {
    const newUrl = new Url({ shortCode, originalUrl: url, isCustom, expiresAt });
    await newUrl.save();

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const shortUrl = `${baseUrl}/${shortCode}`;

    // Generate QR as base64 data-URL (small, inline)
    const qrDataUrl = await QRCode.toDataURL(shortUrl, {
      width: 256,
      margin: 2,
      color: { dark: "#5b6ef5", light: "#0b0c10" },
    });

    return res.status(201).json({
      shortUrl,
      shortCode,
      isCustom,
      qr: qrDataUrl,
      expiresAt,
    });
  } catch (err) {
    console.error("Create error:", err);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ─── GET /api/stats/:shortCode ────────────────────────────────────────────────
// Return analytics data for a short link
router.get("/stats/:shortCode", async (req, res) => {
  try {
    const doc = await Url.findOne({ shortCode: req.params.shortCode });
    if (!doc) return res.status(404).json({ error: "Short link not found." });

    // Aggregate device breakdown from analytics array
    const deviceBreakdown = {};
    const browserBreakdown = {};
    const referrerBreakdown = {};

    for (const click of doc.analytics) {
      deviceBreakdown[click.deviceType]  = (deviceBreakdown[click.deviceType]  || 0) + 1;
      browserBreakdown[click.browser]    = (browserBreakdown[click.browser]    || 0) + 1;
      referrerBreakdown[click.referrer]  = (referrerBreakdown[click.referrer]  || 0) + 1;
    }

    return res.json({
      shortCode:    doc.shortCode,
      originalUrl:  doc.originalUrl,
      isCustom:     doc.isCustom,
      isActive:     doc.isActive,
      clicks:       doc.clicks,
      createdAt:    doc.createdAt,
      lastClickedAt: doc.lastClickedAt,
      expiresAt:    doc.expiresAt,
      deviceBreakdown,
      browserBreakdown,
      referrerBreakdown,
      recentClicks: doc.analytics.slice(-10).reverse(), // last 10 events
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── GET /api/qr/:shortCode ───────────────────────────────────────────────────
// Return/re-generate QR code for any existing short link
router.get("/qr/:shortCode", async (req, res) => {
  try {
    const doc = await Url.findOne({ shortCode: req.params.shortCode });
    if (!doc) return res.status(404).json({ error: "Short link not found." });

    const baseUrl  = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const shortUrl = `${baseUrl}/${doc.shortCode}`;

    const qrDataUrl = await QRCode.toDataURL(shortUrl, {
      width: 512,
      margin: 2,
      color: { dark: "#5b6ef5", light: "#0b0c10" },
    });

    return res.json({ qr: qrDataUrl, shortUrl });
  } catch (err) {
    console.error("QR error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── PATCH /api/toggle/:shortCode ────────────────────────────────────────────
// Enable or disable a link
router.patch("/toggle/:shortCode", async (req, res) => {
  try {
    const doc = await Url.findOne({ shortCode: req.params.shortCode });
    if (!doc) return res.status(404).json({ error: "Short link not found." });

    doc.isActive = !doc.isActive;
    await doc.save();
    return res.json({ isActive: doc.isActive });
  } catch (err) {
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── DELETE /api/delete/:shortCode ───────────────────────────────────────────
// Permanently delete a link
router.delete("/delete/:shortCode", async (req, res) => {
  try {
    const doc = await Url.findOneAndDelete({ shortCode: req.params.shortCode });
    if (!doc) return res.status(404).json({ error: "Short link not found." });
    return res.json({ message: "Deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── Backward-compat alias: POST /api/shorten → /api/create ──────────────────
router.post("/shorten", (req, res, next) => {
  req.url = "/create";
  next("router");
});

module.exports = router;
