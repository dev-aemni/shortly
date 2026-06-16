require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const Url = require("./models/Url");
const urlRoutes = require("./routes/url");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// ─── API Routes ────────────────────────────────────────────────
app.use("/api", urlRoutes);

// ─── Redirect Route ────────────────────────────────────────────
// GET /:code — find the original URL and redirect
app.get("/:code", async (req, res) => {
  const { code } = req.params;

  // Skip non-short-code paths (e.g. favicon.ico)
  if (code.includes(".")) {
    return res.status(404).send("Not found.");
  }

  try {
    const urlDoc = await Url.findOne({ shortCode: code });

    if (!urlDoc) {
      return res.status(404).sendFile(path.join(__dirname, "../frontend/index.html"));
    }

    // Increment click counter (non-blocking)
    urlDoc.clicks += 1;
    urlDoc.save().catch((err) => console.error("Click save error:", err));

    return res.redirect(urlDoc.originalUrl);
  } catch (err) {
    console.error("Redirect error:", err);
    return res.status(500).send("Server error.");
  }
});

// ─── MongoDB Connection ────────────────────────────────────────
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
