const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const { runFullAnalysis } = require('../services/geminiService');
const { getAllNews } = require('../services/newsService');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// POST /api/analysis/analyze
router.post('/analyze', upload.single('chart'), async (req, res) => {
  try {
    const { stockName } = req.body;
    if (!stockName) return res.status(400).json({ error: 'stockName is required' });

    const cleanSymbol = stockName.toUpperCase().trim();
    const nsSymbol = cleanSymbol.includes('.') ? cleanSymbol : `${cleanSymbol}.NS`;

    // Fetch stock data via Yahoo Finance v8 chart API
    let stockData = null;
    try {
      const { data } = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(nsSymbol)}?interval=1d&range=2d`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': '*/*' }, timeout: 8000 }
      );
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta) {
        const prevClose = meta.chartPreviousClose || meta.previousClose;
        const price = meta.regularMarketPrice;
        stockData = {
          symbol: cleanSymbol,
          name: meta.longName || meta.shortName || cleanSymbol,
          price,
          previousClose: prevClose,
          change: price - prevClose,
          changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
          volume: meta.regularMarketVolume,
          high: meta.regularMarketDayHigh,
          low: meta.regularMarketDayLow,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
        };
      }
    } catch (e) {
      console.warn('Could not fetch stock quote:', e.message);
    }

    // Fetch news
    const news = await getAllNews(cleanSymbol);

    // Single Gemini call for everything (1 API call instead of 3)
    const imageBase64 = req.file ? req.file.buffer.toString('base64') : null;
    const mimeType = req.file ? req.file.mimetype : null;
    const previousClose = stockData?.previousClose || stockData?.price || 0;

    const { technicalAnalysis, fundamentalAnalysis, finalPrediction } = await runFullAnalysis(
      cleanSymbol, previousClose, news, imageBase64, mimeType
    );

    res.json({
      stockName: cleanSymbol,
      stockData,
      news,
      technicalAnalysis,
      fundamentalAnalysis,
      finalPrediction,
      chartProvided: !!req.file,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

module.exports = router;
