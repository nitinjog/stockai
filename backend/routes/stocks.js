const express = require('express');
const router = express.Router();
const axios = require('axios');

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
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

async function fetchChartQuote(symbol) {
  const { data } = await axios.get(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
    { headers: YF_HEADERS, timeout: 10000 }
  );
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const prevClose = meta.chartPreviousClose || meta.previousClose;
  const price = meta.regularMarketPrice;
  const change = price - prevClose;
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;
  return {
    symbol: symbol.replace('.NS', '').replace('.BO', '').replace('%26', '&'),
    name: meta.longName || meta.shortName || symbol,
    price,
    previousClose: prevClose,
    change,
    changePercent,
    volume: meta.regularMarketVolume,
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
  };
}

// GET /api/stocks/top-movers
router.get('/top-movers', async (req, res) => {
  try {
    const results = await Promise.allSettled(
      NIFTY_50_SYMBOLS.map(s => fetchChartQuote(s))
    );
    const quotes = results
      .filter(r => r.status === 'fulfilled' && r.value && r.value.changePercent != null)
      .map(r => r.value)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 10);
    res.json(quotes);
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
    const quote = await fetchChartQuote(nsSymbol);
    if (!quote) return res.status(404).json({ error: 'Stock not found' });
    res.json({ ...quote, symbol, fullSymbol: nsSymbol });
  } catch (err) {
    console.error('Quote error:', err.message);
    res.status(500).json({ error: 'Failed to fetch quote', details: err.message });
  }
});

module.exports = router;
