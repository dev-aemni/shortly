# ⚡ Shortly — URL Shortener

A clean, production-ready URL shortener built with **Node.js**, **Express**, **MongoDB**, and vanilla **HTML/CSS/JS**.

---

## 📁 Folder Structure

```
Shortly/
├── frontend/
│   ├── index.html       # Main UI
│   ├── style.css        # Styles
│   └── script.js        # Frontend logic
│
├── backend/
│   ├── server.js        # Express app entry point
│   ├── models/
│   │   └── Url.js       # Mongoose schema
│   ├── routes/
│   │   └── url.js       # /api/shorten route
│   └── .env             # Environment variables
│
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [MongoDB](https://www.mongodb.com/) (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment

Edit `backend/.env`:

```env
MONGO_URI=mongodb://localhost:27017/shortly
BASE_URL=http://localhost:3000
PORT=3000
```

For **MongoDB Atlas**, replace `MONGO_URI` with your connection string:

```env
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/shortly
```

### 4. Run the server

```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 API Reference

### `POST /api/shorten`

Shorten a URL.

**Request:**
```json
{ "url": "https://example.com/very/long/path" }
```

**Response:**
```json
{ "shortUrl": "http://localhost:3000/abc1234" }
```

**Errors:**
- `400` — Empty or invalid URL
- `500` — Server/database error

---

### `GET /:code`

Redirects to the original URL and increments click count.

---

## 🗄️ Database Model

```js
{
  shortCode:   String,   // e.g. "abc1234"
  originalUrl: String,   // e.g. "https://example.com/..."
  clicks:      Number,   // starts at 0, incremented on each visit
  createdAt:   Date      // auto-set on creation
}
```

---

## ☁️ Deploying

### Render (recommended)

1. Push this repo to GitHub.
2. Create a new **Web Service** on [Render](https://render.com).
3. Set **Root Directory** to `backend`.
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `npm start`
6. Add environment variables in Render's dashboard.
7. Update `BASE_URL` to your Render URL (e.g. `https://shortly.onrender.com`).

---

## ✨ Features

- ⚡ Instant URL shortening with 7-character codes
- 📊 Click tracking per short link
- ✅ URL validation (frontend + backend)
- 📋 One-click copy to clipboard
- 📱 Fully responsive UI
- 🔒 Environment variable config (no hardcoded secrets)
