import { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import TopMovers from './components/TopMovers.jsx';
import StockSearch from './components/StockSearch.jsx';
import ChartUpload from './components/ChartUpload.jsx';
import AnalysisResults from './components/AnalysisResults.jsx';
import { fetchTopMovers, analyzeStock } from './api/index.js';
import { Brain, Loader2, AlertCircle, ChevronDown } from 'lucide-react';

const STEPS = [
  'Fetching stock data...',
  'Scraping financial news...',
  'Analyzing technical chart with Gemini Vision...',
  'Running fundamental analysis...',
  'Synthesizing final prediction...',
];

export default function App() {
  const [movers, setMovers] = useState([]);
  const [moversLoading, setMoversLoading] = useState(true);
  const [moversError, setMoversError] = useState(null);

  const [selectedStock, setSelectedStock] = useState('');
  const [chartFile, setChartFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const loadMovers = async () => {
    setMoversLoading(true);
    setMoversError(null);
    try {
      const data = await fetchTopMovers();
      setMovers(data);
    } catch (e) {
      setMoversError('Could not load top movers. Backend may be starting up — try refreshing.');
    } finally {
      setMoversLoading(false);
    }
  };

  useEffect(() => { loadMovers(); }, []);

  const handleSelectFromMovers = (symbol) => {
    setSelectedStock(symbol);
    setResult(null);
    setError(null);
    window.scrollTo({ top: document.getElementById('analyze-section')?.offsetTop - 80, behavior: 'smooth' });
  };

  const handleAnalyze = async () => {
    if (!selectedStock.trim()) { setError('Please enter or select a stock symbol.'); return; }
    setError(null);
    setResult(null);
    setLoading(true);
    setLoadingStep(0);

    // Simulate step progression
    const intervals = STEPS.map((_, i) =>
      setTimeout(() => setLoadingStep(i), i * (chartFile ? 5000 : 3500))
    );

    try {
      const data = await analyzeStock(selectedStock.trim().toUpperCase(), chartFile);
      intervals.forEach(clearTimeout);
      setResult(data);
      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (e) {
      intervals.forEach(clearTimeout);
      const msg = e.response?.data?.error || e.message || 'Analysis failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Top Movers */}
        <TopMovers
          movers={movers}
          loading={moversLoading}
          error={moversError}
          onSelect={handleSelectFromMovers}
          onRefresh={loadMovers}
        />

        {/* Analyze Section */}
        <section id="analyze-section" className="max-w-2xl mx-auto">
          <div className="card p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white mb-0.5">Analyze a Stock</h2>
              <p className="text-slate-500 text-sm">
                Enter an NSE symbol, optionally upload a chart screenshot, and get an AI-powered prediction.
              </p>
            </div>

            <StockSearch value={selectedStock} onChange={setSelectedStock} />
            <ChartUpload onFileChange={setChartFile} />

            {error && (
              <div className="flex items-start gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading || !selectedStock.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain size={18} />
                  Analyze with AI
                </>
              )}
            </button>
          </div>

          {/* Loading steps */}
          {loading && (
            <div className="mt-4 card p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Analysis in progress</p>
              <div className="space-y-2">
                {STEPS.map((step, i) => (
                  <div key={i} className={`flex items-center gap-2.5 text-sm transition-all duration-300
                    ${i < loadingStep ? 'text-emerald-400' : i === loadingStep ? 'text-slate-200' : 'text-slate-600'}`}
                  >
                    {i < loadingStep ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      </div>
                    ) : i === loadingStep ? (
                      <Loader2 size={16} className="animate-spin text-indigo-400 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                    )}
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Results */}
        {result && (
          <section id="results-section" className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-slate-700/50" />
              <h2 className="text-sm font-medium text-slate-400 px-2">Analysis Results — {result.stockName}</h2>
              <div className="h-px flex-1 bg-slate-700/50" />
            </div>
            <AnalysisResults result={result} />
          </section>
        )}
      </main>

      <footer className="border-t border-slate-800 mt-16 py-6 text-center text-xs text-slate-600">
        <p>StockAI · Indian Market Intelligence · Powered by Gemini AI & Yahoo Finance</p>
        <p className="mt-1">For informational purposes only. Not financial advice. Always do your own research.</p>
      </footer>
    </div>
  );
}
