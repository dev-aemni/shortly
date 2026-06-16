const mongoose = require("mongoose");

// Sub-schema for individual click events (analytics)
const clickSchema = new mongoose.Schema(
  {
    timestamp:  { type: Date, default: Date.now },
    referrer:   { type: String, default: "direct" },
    userAgent:  { type: String, default: "" },
    deviceType: { type: String, enum: ["desktop", "mobile", "tablet", "unknown"], default: "unknown" },
    browser:    { type: String, default: "unknown" },
  },
  { _id: false }
);

const urlSchema = new mongoose.Schema({
  // ── Core ──────────────────────────────────────────────────────
  shortCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  originalUrl: {
    type: String,
    required: true,
    trim: true,
  },

  // ── Custom slug (user-defined alias) ──────────────────────────
  // shortCode IS the slug — custom slugs are stored the same way.
  // This flag marks whether the code was user-supplied or auto-generated.
  isCustom: {
    type: Boolean,
    default: false,
  },

  // ── Click counter (fast, denormalized) ────────────────────────
  clicks: {
    type: Number,
    default: 0,
  },

  // ── Analytics: last 500 click events ──────────────────────────
  analytics: {
    type: [clickSchema],
    default: [],
  },

  lastClickedAt: {
    type: Date,
    default: null,
  },

  // ── Link management ───────────────────────────────────────────
  isActive: {
    type: Boolean,
    default: true,
  },
  expiresAt: {
    type: Date,
    default: null, // null = never expires
  },
},
{
  timestamps: true, // adds createdAt + updatedAt automatically
});

module.exports = mongoose.model("Url", urlSchema);
