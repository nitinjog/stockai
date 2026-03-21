# StockAI — Indian Market Intelligence

AI-powered stock analysis for NSE/BSE using Gemini Vision + news aggregation.

## Features
- **Top 10 Movers** — Nifty 50 stocks sorted by % movement
- **Technical Analysis** — Upload a chart screenshot; Gemini Vision analyzes candlesticks, patterns, indicators
- **Fundamental Analysis** — Aggregates news from Google News, Economic Times, Moneycontrol, Business Standard, NewsAPI
- **AI Prediction** — Gemini synthesizes both analyses → target price, stop loss, range, recommendation

## Stack
- **Frontend**: React + Vite + Tailwind → Netlify
- **Backend**: Node.js + Express → Render
- **AI**: Google Gemini 1.5 Flash (vision + text)
- **Data**: Yahoo Finance (free), NewsAPI, RSS feeds

## Local Development

```bash
# Backend
cd backend && npm install
cp .env.example .env   # fill in your keys
npm run dev            # runs on :3001

# Frontend (new terminal)
cd frontend && npm install
npm run dev            # runs on :5173
```

## Deployment

### Backend → Render
1. Push repo to GitHub
2. Create new Web Service on Render, connect repo
3. Set env vars in Render dashboard:
   - `GEMINI_API_KEY`
   - `NEWS_API_KEY`
   - `NODE_ENV=production`

### Frontend → Netlify
1. Connect repo to Netlify
2. Set env var in Netlify dashboard:
   - `VITE_API_URL=https://your-render-app.onrender.com`
3. Deploy — Netlify reads `netlify.toml` automatically

## Disclaimer
For informational purposes only. Not financial advice.
