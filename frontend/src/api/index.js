import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({ baseURL: API_BASE, timeout: 60000 });

export const fetchTopMovers = () => api.get('/stocks/top-movers').then(r => r.data);

export const searchStocks = (query) => api.get(`/stocks/search/${encodeURIComponent(query)}`).then(r => r.data);

export const fetchStockQuote = (symbol) => api.get(`/stocks/quote/${encodeURIComponent(symbol)}`).then(r => r.data);

export const fetchNews = (stockName) => api.get(`/news/${encodeURIComponent(stockName)}`).then(r => r.data);

export const analyzeStock = (stockName, chartFile) => {
  const formData = new FormData();
  formData.append('stockName', stockName);
  if (chartFile) formData.append('chart', chartFile);
  return api.post('/analysis/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }).then(r => r.data);
};
