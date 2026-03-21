require('dotenv').config();
const express = require('express');
const cors = require('cors');

const stockRoutes = require('./routes/stocks');
const newsRoutes = require('./routes/news');
const analysisRoutes = require('./routes/analysis');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/stocks', stockRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/analysis', analysisRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`StockAI Backend running on port ${PORT}`);
});
