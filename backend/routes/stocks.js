const express = require('express');
const router = express.Router();
const axios = require('axios');

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

const NIFTY_50_SYMBOLS = [
  'ADANIENT.NS', 'ADANIPORTS.NS', 'APOLLOHOSP.NS', 'ASIANPAINT.NS', 'AXISBANK.NS',
  'BAJAJ-AUTO.NS', 'BAJFINANCE.NS', 'BAJAJFINSV.NS', 'BPCL.NS', 'BHARTIARTL.NS',
  'BRITANNIA.NS', 'CIPLA.NS', 'COALINDIA.NS', 'DIVISLAB.NS', 'DRREDDY.NS',
  'EICHERMOT.NS', 'GRASIM.NS', 'HCLTECH.NS', 'HDFCBANK.NS', 'HDFCLIFE.NS',
  'HEROMOTOCO.NS', 'HINDALCO.NS', 'HINDUNILVR.NS', 'ICICIBANK.NS', 'ITC.NS',
  'INDUSINDBK.NS', 'INFY.NS', 'JSWSTEEL.NS', 'KOTAKBANK.NS', 'LT.NS',
  'M%26M.NS', 'MARUTI.NS', 'NTPC.NS', 'NESTLEIND.NS', 'ONGC.NS',
  'POWERGRID.NS', 'RELIANCE.NS', 'SBILIFE.NS', 'SBIN.NS', 'SHREECEM.NS',
  'SUNPHARMA.NS', 'TATACONSUM.NS', 'TATAMOTORS.NS', 'TATASTEEL.NS', 'TCS.NS',
  'TECHM.NS', 'TITAN.NS', 'UPL.NS', 'ULTRACEMCO.NS', 'WIPRO.NS'
];

async function fetchQuotes(symbols) {
  const chunks = [];
  for (let i = 0; i < symbols.length; i += 20) {
    chunks.push(symbols.slice(i, i + 20));
  }
  const results = [];
  for (const chunk of chunks) {
    try {
      const { data } = await axios.get(
        `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${chunk.join(',')}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketDayHigh,regularMarketDayLow,regularMarketPreviousClose,shortName,longName`,
        { headers: YF_HEADERS, timeout: 10000 }
      );
      const quotes = data?.quoteResponse?.result || [];
      results.push(...quotes);
    } catch (e) {
      console.warn('Chunk fetch error:', e.message);
    }
  }
  return results;
}

// GET /api/stocks/top-movers
router.get('/top-movers', async (req, res) => {
  try {
    const quotes = await fetchQuotes(NIFTY_50_SYMBOLS);
    const sorted = quotes
      .filter(q => q.regularMarketChangePercent != null)
      .sort((a, b) => Math.abs(b.regularMarketChangePercent) - Math.abs(a.regularMarketChangePercent))
      .slice(0, 10)
      .map(q => ({
        symbol: q.symbol?.replace('.NS', '').replace('.BO', '').replace('%26', '&'),
        name: q.longName || q.shortName || q.symbol,
        price: q.regularMarketPrice,
        previousClose: q.regularMarketPreviousClose,
        change: q.regularMarketChange,
        changePercent: q.regularMarketChangePercent,
        volume: q.regularMarketVolume,
        high: q.regularMarketDayHigh,
        low: q.regularMarketDayLow,
      }));
    res.json(sorted);
  } catch (err) {
    console.error('Top movers error:', err.message);
    res.status(500).json({ error: 'Failed to fetch top movers', details: err.message });
  }
});

// GET /api/stocks/search/:query
router.get('/search/:query', async (req, res) => {
  try {
    const { data } = await axios.get(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(req.params.query)}&quotesCount=8&newsCount=0&listsCount=0`,
      { headers: YF_HEADERS, timeout: 8000 }
    );
    const stocks = (data?.finance?.result?.[0]?.quotes || [])
      .filter(q => q.quoteType === 'EQUITY' && (q.symbol?.endsWith('.NS') || q.symbol?.endsWith('.BO')))
      .slice(0, 6)
      .map(q => ({
        symbol: q.symbol?.replace('.NS', '').replace('.BO', ''),
        fullSymbol: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchange,
      }));
    res.json(stocks);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// GET /api/stocks/quote/:symbol
router.get('/quote/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const nsSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    const { data } = await axios.get(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(nsSymbol)}`,
      { headers: YF_HEADERS, timeout: 8000 }
    );
    const q = data?.quoteResponse?.result?.[0];
    if (!q) return res.status(404).json({ error: 'Stock not found' });
    res.json({
      symbol,
      fullSymbol: nsSymbol,
      name: q.longName || q.shortName || symbol,
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
    });
  } catch (err) {
    console.error('Quote error:', err.message);
    res.status(500).json({ error: 'Failed to fetch quote', details: err.message });
  }
});

module.exports = router;
