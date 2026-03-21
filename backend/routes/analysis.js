const express = require('express');
const router = express.Router();
const multer = require('multer');
const yahooFinance = require('yahoo-finance2').default;
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
      const quote = await yahooFinance.quote(nsSymbol, {}, { validateResult: false });
      stockData = {
        symbol: cleanSymbol,
        name: quote.longName || quote.shortName || cleanSymbol,
        price: quote.regularMarketPrice,
        previousClose: quote.regularMarketPreviousClose,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        volume: quote.regularMarketVolume,
        high: quote.regularMarketDayHigh,
        low: quote.regularMarketDayLow,
        marketCap: quote.marketCap,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        pe: quote.trailingPE,
      };
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
