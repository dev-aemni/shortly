// ─── DOM refs ────────────────────────────────────────────────────────────────
const urlInput     = document.getElementById("urlInput");
const slugInput    = document.getElementById("slugInput");
const expirySelect = document.getElementById("expirySelect");
const shortenBtn   = document.getElementById("shortenBtn");
const btnText      = shortenBtn.querySelector(".btn-text");
const btnLoader    = shortenBtn.querySelector(".btn-loader");
const errorMsg     = document.getElementById("errorMsg");
const result       = document.getElementById("result");
const shortLink    = document.getElementById("shortLink");
const expiryBadge  = document.getElementById("expiryBadge");
const copyBtn      = document.getElementById("copyBtn");
const qrBtn        = document.getElementById("qrBtn");
const statsBtn     = document.getElementById("statsBtn");
const qrPanel      = document.getElementById("qrPanel");
const statsPanel   = document.getElementById("statsPanel");
const qrImage      = document.getElementById("qrImage");
const downloadQr   = document.getElementById("downloadQr");
const statsRefresh = document.getElementById("statsRefresh");
const advToggle    = document.getElementById("advToggle");
const advPanel     = document.getElementById("advPanel");
const slugPrefix   = document.getElementById("slugPrefix");

// ─── State ───────────────────────────────────────────────────────────────────
let isLoading    = false;
let currentCode  = null;
let currentQrUrl = null;

// ─── Advanced toggle ──────────────────────────────────────────────────────────
advToggle.addEventListener("click", () => {
  advToggle.classList.toggle("open");
  advPanel.classList.toggle("open");
});

// ─── Update slug prefix to show real domain ───────────────────────────────────
(function setSlugPrefix() {
  const host = window.location.hostname;
  slugPrefix.textContent = (host === "localhost" ? "localhost/" : host.replace(/^www\./, "") + "/");
})();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  result.hidden = true;
}
function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}
function setLoading(v) {
  isLoading = v;
  shortenBtn.disabled = v;
  btnText.hidden = v;
  btnLoader.hidden = !v;
}
function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function buildBreakdown(el, title, obj) {
  if (!obj || !Object.keys(obj).length) { el.innerHTML = ""; return; }
  const sorted = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 4);
  el.innerHTML = `<div class="breakdown-title">${title}</div>` +
    sorted.map(([k, v]) => `<div class="breakdown-item"><span>${k}</span><span>${v}</span></div>`).join("");
}

// ─── Main: shorten URL ────────────────────────────────────────────────────────
async function shortenUrl() {
  if (isLoading) return;

  const url  = urlInput.value.trim();
  const slug = slugInput.value.trim();
  const exp  = expirySelect.value;

  if (!url) { showError("Please enter a URL first."); urlInput.focus(); return; }

  setLoading(true);
  clearError();
  result.hidden = true;
  qrPanel.hidden = true;
  statsPanel.hidden = true;
  currentCode = null;

  try {
    const res  = await fetch("/api/create", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ url, customSlug: slug || undefined, expiresIn: exp || undefined }),
    });
    const data = await res.json();

    if (!res.ok) { showError(data.error || "Something went wrong."); return; }

    // ── Show result ────────────────────────────────────────────
    currentCode  = data.shortCode;
    currentQrUrl = data.qr;

    shortLink.textContent = data.shortUrl;
    shortLink.href        = data.shortUrl;

    if (data.expiresAt) {
      expiryBadge.textContent = `Expires ${fmt(data.expiresAt)}`;
      expiryBadge.hidden      = false;
    } else {
      expiryBadge.hidden = true;
    }

    // Pre-load QR into img (from create response, no extra request needed)
    if (data.qr) {
      qrImage.src = data.qr;
    }

    result.hidden  = false;
    clearError();

    // Reset button states
    [copyBtn, qrBtn, statsBtn].forEach(b => b.classList.remove("active", "copied"));
    copyBtn.querySelector("span").textContent = "Copy";
    qrBtn.querySelector("span").textContent   = "QR";

  } catch {
    showError("Network error. Check your connection and try again.");
  } finally {
    setLoading(false);
  }
}

// ─── Copy ─────────────────────────────────────────────────────────────────────
async function copyToClipboard() {
  const url = shortLink.textContent;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const tmp = document.createElement("textarea");
    tmp.value = url;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand("copy");
    document.body.removeChild(tmp);
  }
  copyBtn.classList.add("copied");
  copyBtn.querySelector("span").textContent = "Copied!";
  setTimeout(() => {
    copyBtn.classList.remove("copied");
    copyBtn.querySelector("span").textContent = "Copy";
  }, 2000);
}

// ─── QR toggle ───────────────────────────────────────────────────────────────
function toggleQr() {
  const open = !qrPanel.hidden;
  qrPanel.hidden   = open;
  statsPanel.hidden = true;
  statsBtn.classList.remove("active");
  qrBtn.classList.toggle("active", !open);
  qrBtn.querySelector("span").textContent = open ? "QR" : "Hide QR";
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function toggleStats() {
  const open = !statsPanel.hidden;
  if (open) {
    statsPanel.hidden = true;
    statsBtn.classList.remove("active");
    return;
  }
  qrPanel.hidden = true;
  qrBtn.classList.remove("active");
  qrBtn.querySelector("span").textContent = "QR";
  await loadStats();
}

async function loadStats() {
  if (!currentCode) return;
  statsPanel.hidden = false;
  statsBtn.classList.add("active");
  // Show placeholders
  ["sTotalClicks","sCreated","sLastClick","sStatus"].forEach(id => {
    document.getElementById(id).textContent = "…";
  });
  try {
    const res  = await fetch(`/api/stats/${currentCode}`);
    const data = await res.json();
    if (!res.ok) { statsPanel.hidden = true; return; }

    document.getElementById("sTotalClicks").textContent = data.clicks ?? 0;
    document.getElementById("sCreated").textContent     = fmt(data.createdAt);
    document.getElementById("sLastClick").textContent   = fmt(data.lastClickedAt) || "Never";
    document.getElementById("sStatus").textContent      = data.isActive ? "Active" : "Disabled";

    buildBreakdown(document.getElementById("bdDevice"),  "Devices",   data.deviceBreakdown);
    buildBreakdown(document.getElementById("bdBrowser"), "Browsers",  data.browserBreakdown);
  } catch {
    statsPanel.hidden = true;
  }
}

// ─── Download QR ──────────────────────────────────────────────────────────────
function downloadQrCode() {
  if (!currentQrUrl) return;
  const a  = document.createElement("a");
  a.href   = currentQrUrl;
  a.download = `shortly-${currentCode || "qr"}.png`;
  a.click();
}

// ─── Events ──────────────────────────────────────────────────────────────────
shortenBtn.addEventListener("click",  shortenUrl);
urlInput.addEventListener("keydown",  e => { if (e.key === "Enter") shortenUrl(); });
copyBtn.addEventListener("click",     copyToClipboard);
qrBtn.addEventListener("click",       toggleQr);
statsBtn.addEventListener("click",    toggleStats);
statsRefresh.addEventListener("click", loadStats);
downloadQr.addEventListener("click",  downloadQrCode);
