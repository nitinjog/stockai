const express = require('express');
const router = express.Router();
const yahooFinance = require('yahoo-finance2').default;

const NIFTY_50_SYMBOLS = [
  'ADANIENT.NS', 'ADANIPORTS.NS', 'APOLLOHOSP.NS', 'ASIANPAINT.NS', 'AXISBANK.NS',
  'BAJAJ-AUTO.NS', 'BAJFINANCE.NS', 'BAJAJFINSV.NS', 'BPCL.NS', 'BHARTIARTL.NS',
  'BRITANNIA.NS', 'CIPLA.NS', 'COALINDIA.NS', 'DIVISLAB.NS', 'DRREDDY.NS',
  'EICHERMOT.NS', 'GRASIM.NS', 'HCLTECH.NS', 'HDFCBANK.NS', 'HDFCLIFE.NS',
  'HEROMOTOCO.NS', 'HINDALCO.NS', 'HINDUNILVR.NS', 'ICICIBANK.NS', 'ITC.NS',
  'INDUSINDBK.NS', 'INFY.NS', 'JSWSTEEL.NS', 'KOTAKBANK.NS', 'LT.NS',
  'M&M.NS', 'MARUTI.NS', 'NTPC.NS', 'NESTLEIND.NS', 'ONGC.NS',
  'POWERGRID.NS', 'RELIANCE.NS', 'SBILIFE.NS', 'SBIN.NS', 'SHREECEM.NS',
  'SUNPHARMA.NS', 'TATACONSUM.NS', 'TATAMOTORS.NS', 'TATASTEEL.NS', 'TCS.NS',
  'TECHM.NS', 'TITAN.NS', 'UPL.NS', 'ULTRACEMCO.NS', 'WIPRO.NS'
];

// GET /api/stocks/top-movers
router.get('/top-movers', async (req, res) => {
  try {
    const results = await Promise.allSettled(
      NIFTY_50_SYMBOLS.map(symbol =>
        yahooFinance.quote(symbol, {}, { validateResult: false })
      )
    );

    const quotes = results
      .filter(r => r.status === 'fulfilled' && r.value && r.value.regularMarketChangePercent != null)
      .map(r => r.value)
      .sort((a, b) => Math.abs(b.regularMarketChangePercent) - Math.abs(a.regularMarketChangePercent))
      .slice(0, 10)
      .map(q => ({
        symbol: q.symbol?.replace('.NS', '').replace('.BO', ''),
        fullSymbol: q.symbol,
        name: q.longName || q.shortName || q.symbol,
        price: q.regularMarketPrice,
        previousClose: q.regularMarketPreviousClose,
        change: q.regularMarketChange,
        changePercent: q.regularMarketChangePercent,
        volume: q.regularMarketVolume,
        high: q.regularMarketDayHigh,
        low: q.regularMarketDayLow,
      }));

    res.json(quotes);
  } catch (err) {
    console.error('Top movers error:', err.message);
    res.status(500).json({ error: 'Failed to fetch top movers', details: err.message });
  }
});

// GET /api/stocks/search/:query
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const results = await yahooFinance.search(query, { newsCount: 0, quotesCount: 8 }, { validateResult: false });

    const stocks = (results.quotes || [])
      .filter(q => q.quoteType === 'EQUITY' && (q.symbol?.endsWith('.NS') || q.symbol?.endsWith('.BO') || q.exchange === 'NSI' || q.exchange === 'BSE'))
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

    const quote = await yahooFinance.quote(nsSymbol, {}, { validateResult: false });

    res.json({
      symbol: symbol,
      fullSymbol: nsSymbol,
      name: quote.longName || quote.shortName || symbol,
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
      avgVolume: quote.averageDailyVolume3Month,
      pe: quote.trailingPE,
      sector: quote.sector || '',
    });
  } catch (err) {
    console.error('Quote error:', err.message);
    res.status(500).json({ error: 'Failed to fetch quote', details: err.message });
  }
});

module.exports = router;
