const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const { analyzeTechnicalChart, analyzeFundamentals, getFinalPrediction } = require('../services/geminiService');
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

    // Fetch stock data
    let stockData = null;
    try {
      const { data } = await axios.get(
        `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(nsSymbol)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }
      );
      const q = data?.quoteResponse?.result?.[0];
      if (q) {
        stockData = {
          symbol: cleanSymbol,
          name: q.longName || q.shortName || cleanSymbol,
          price: q.regularMarketPrice,
          previousClose: q.regularMarketPreviousClose,
          change: q.regularMarketChange,
          changePercent: q.regularMarketChangePercent,
          volume: q.regularMarketVolume,
          high: q.regularMarketDayHigh,
          low: q.regularMarketDayLow,
          marketCap: q.marketCap,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow,
          pe: q.trailingPE,
        };
      }
    } catch (e) {
      console.warn('Could not fetch stock quote:', e.message);
    }

    // Fetch news
    const news = await getAllNews(cleanSymbol);

    // Technical analysis (Gemini Vision)
    let technicalAnalysis = null;
    if (req.file) {
      const imageBase64 = req.file.buffer.toString('base64');
      technicalAnalysis = await analyzeTechnicalChart(imageBase64, req.file.mimetype, cleanSymbol);
    }

    // Fundamental analysis (Gemini + news)
    const fundamentalAnalysis = await analyzeFundamentals(cleanSymbol, news);

    // Final prediction (Gemini synthesis)
    const previousClose = stockData?.previousClose || stockData?.price || 0;
    const techText = technicalAnalysis || 'No technical chart provided. Base prediction on fundamentals only.';
    const finalPrediction = await getFinalPrediction(cleanSymbol, previousClose, techText, fundamentalAnalysis);

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
