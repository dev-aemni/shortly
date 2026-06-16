const express = require("express");
const router = express.Router();
const { nanoid } = require("nanoid");
const Url = require("../models/Url");

// Validate URL format
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// POST /api/shorten — create a short URL
router.post("/shorten", async (req, res) => {
  const { url } = req.body;

  // Validate input
  if (!url || url.trim() === "") {
    return res.status(400).json({ error: "URL is required." });
  }

  if (!isValidUrl(url)) {
    return res
      .status(400)
      .json({ error: "Invalid URL. Must start with http:// or https://" });
  }

  try {
    // Generate a unique 7-char short code
    const shortCode = nanoid(7);

    const newUrl = new Url({
      shortCode,
      originalUrl: url,
    });

    await newUrl.save();

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    return res.status(201).json({ shortUrl: `${baseUrl}/${shortCode}` });
  } catch (err) {
    console.error("Shorten error:", err);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

module.exports = router;
