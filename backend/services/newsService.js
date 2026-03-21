const axios = require('axios');
const Parser = require('rss-parser');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; StockAI/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  timeout: 8000,
});

const RSS_FEEDS = [
  { url: 'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms', source: 'Economic Times' },
  { url: 'https://economictimes.indiatimes.com/rssfeedstopstories.cms', source: 'Economic Times' },
  { url: 'https://www.moneycontrol.com/rss/latestnews.xml', source: 'Moneycontrol' },
  { url: 'https://www.business-standard.com/rss/markets-106.rss', source: 'Business Standard' },
  { url: 'https://www.livemint.com/rss/markets', source: 'Livemint' },
  { url: 'https://feeds.feedburner.com/ndtvprofit-latest', source: 'NDTV Profit' },
];

async function fetchGoogleNewsRSS(stockName) {
  try {
    const query = encodeURIComponent(`${stockName} NSE India stock`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;
    const feed = await parser.parseURL(url);
    return (feed.items || []).slice(0, 8).map(item => ({
      title: item.title,
      description: item.contentSnippet || item.content || '',
      url: item.link,
      source: 'Google News',
      publishedAt: item.pubDate,
    }));
  } catch (err) {
    console.error('Google News RSS error:', err.message);
    return [];
  }
}

async function fetchRSSFeeds(stockName) {
  const stockLower = stockName.toLowerCase();
  const allItems = [];

  const feedPromises = RSS_FEEDS.map(async ({ url, source }) => {
    try {
      const feed = await parser.parseURL(url);
      const relevant = (feed.items || []).filter(item => {
        const text = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase();
        return text.includes(stockLower) || text.includes('nifty') || text.includes('sensex') || text.includes('market');
      });
      return relevant.slice(0, 3).map(item => ({
        title: item.title,
        description: item.contentSnippet || '',
        url: item.link,
        source,
        publishedAt: item.pubDate,
      }));
    } catch (err) {
      return [];
    }
  });

  const results = await Promise.allSettled(feedPromises);
  results.forEach(r => { if (r.status === 'fulfilled') allItems.push(...r.value); });
  return allItems;
}

async function fetchNewsAPI(stockName) {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) return [];

    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: `"${stockName}" NSE OR BSE OR India stock market`,
        apiKey,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
        from: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      timeout: 8000,
    });

    return (response.data.articles || []).map(a => ({
      title: a.title,
      description: a.description,
      url: a.url,
      source: a.source?.name || 'NewsAPI',
      publishedAt: a.publishedAt,
    }));
  } catch (err) {
    console.error('NewsAPI error:', err.message);
    return [];
  }
}

async function getAllNews(stockName) {
  const [googleNews, rssNews, apiNews] = await Promise.allSettled([
    fetchGoogleNewsRSS(stockName),
    fetchRSSFeeds(stockName),
    fetchNewsAPI(stockName),
  ]);

  const combined = [
    ...(googleNews.status === 'fulfilled' ? googleNews.value : []),
    ...(apiNews.status === 'fulfilled' ? apiNews.value : []),
    ...(rssNews.status === 'fulfilled' ? rssNews.value : []),
  ];

  // Deduplicate by title
  const seen = new Set();
  return combined.filter(item => {
    if (!item.title || seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  }).slice(0, 20);
}

module.exports = { getAllNews };
