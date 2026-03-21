const express = require('express');
const router = express.Router();
const { getAllNews } = require('../services/newsService');

// GET /api/news/:stockName
router.get('/:stockName', async (req, res) => {
  try {
    const news = await getAllNews(req.params.stockName);
    res.json(news);
  } catch (err) {
    console.error('News route error:', err.message);
    res.status(500).json({ error: 'Failed to fetch news', details: err.message });
  }
});

module.exports = router;
