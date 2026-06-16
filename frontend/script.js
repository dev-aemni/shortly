// ─── DOM References ──────────────────────────────────────────
const urlInput   = document.getElementById("urlInput");
const shortenBtn = document.getElementById("shortenBtn");
const btnText    = shortenBtn.querySelector(".btn-text");
const btnLoader  = shortenBtn.querySelector(".btn-loader");
const errorMsg   = document.getElementById("errorMsg");
const result     = document.getElementById("result");
const shortLink  = document.getElementById("shortLink");
const copyBtn    = document.getElementById("copyBtn");

// ─── State ───────────────────────────────────────────────────
let isLoading = false;

// ─── Helpers ─────────────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  result.hidden = true;
}

function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}

function setLoading(loading) {
  isLoading = loading;
  shortenBtn.disabled = loading;
  btnText.hidden = loading;
  btnLoader.hidden = !loading;
}

function showResult(url) {
  shortLink.textContent = url;
  shortLink.href = url;
  result.hidden = false;
  clearError();

  // Reset copy button state
  copyBtn.classList.remove("copied");
  copyBtn.querySelector("span").textContent = "Copy";
}

// ─── Shorten ─────────────────────────────────────────────────
async function shortenUrl() {
  if (isLoading) return;

  const raw = urlInput.value.trim();

  // Client-side empty check
  if (!raw) {
    showError("Please enter a URL first.");
    urlInput.focus();
    return;
  }

  setLoading(true);
  clearError();
  result.hidden = true;

  try {
    const res = await fetch("/api/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: raw }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Server returned a validation or server error
      showError(data.error || "Something went wrong. Try again.");
      return;
    }

    showResult(data.shortUrl);
  } catch {
    showError("Network error. Check your connection and try again.");
  } finally {
    setLoading(false);
  }
}

// ─── Copy ─────────────────────────────────────────────────────
async function copyToClipboard() {
  const url = shortLink.textContent;
  if (!url) return;

  try {
    await navigator.clipboard.writeText(url);
    copyBtn.classList.add("copied");
    copyBtn.querySelector("span").textContent = "Copied!";

    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyBtn.querySelector("span").textContent = "Copy";
    }, 2000);
  } catch {
    // Fallback for older browsers
    const tmp = document.createElement("textarea");
    tmp.value = url;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand("copy");
    document.body.removeChild(tmp);

    copyBtn.querySelector("span").textContent = "Copied!";
    setTimeout(() => {
      copyBtn.querySelector("span").textContent = "Copy";
    }, 2000);
  }
}

// ─── Events ──────────────────────────────────────────────────
shortenBtn.addEventListener("click", shortenUrl);

// Allow pressing Enter in the input field
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") shortenUrl();
});

copyBtn.addEventListener("click", copyToClipboard);
