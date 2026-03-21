import { useState } from 'react';
import {
  Target, TrendingUp, TrendingDown, Minus, Shield,
  BarChart2, Newspaper, Brain, ChevronDown, ChevronUp,
  ExternalLink, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';

function formatINR(n) {
  if (!n) return '—';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(n) {
  if (n == null) return '—';
  const v = Number(n);
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function RecBadge({ rec }) {
  if (rec === 'BUY') return <span className="badge-buy">{rec}</span>;
  if (rec === 'SELL') return <span className="badge-sell">{rec}</span>;
  return <span className="badge-hold">{rec || 'HOLD'}</span>;
}

function ConfidenceDots({ level }) {
  const map = { High: 3, Medium: 2, Low: 1 };
  const count = map[level] || 1;
  const color = count === 3 ? 'bg-emerald-400' : count === 2 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map(i => (
        <div key={i} className={`w-2 h-2 rounded-full ${i <= count ? color : 'bg-slate-700'}`} />
      ))}
      <span className="text-xs text-slate-400 ml-1">{level}</span>
    </div>
  );
}

function BiasTag({ bias }) {
  if (!bias) return null;
  const cfg = {
    Bullish: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    Bearish: 'text-red-400 bg-red-500/10 border-red-500/30',
    Neutral: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  };
  return (
    <span className={`text-xs font-medium border px-2 py-0.5 rounded-full ${cfg[bias] || cfg.Neutral}`}>
      {bias}
    </span>
  );
}

function PredictionCard({ prediction, stockName, previousClose }) {
  if (!prediction || prediction.error) {
    return (
      <div className="card p-5 border-red-500/30 bg-red-500/5">
        <p className="text-red-400 text-sm">{prediction?.error || 'Prediction unavailable'}</p>
        {prediction?.rawText && <pre className="text-xs text-slate-400 mt-2 whitespace-pre-wrap">{prediction.rawText}</pre>}
      </div>
    );
  }

  const isPositive = (prediction.percentageChange || 0) >= 0;
  const TrendIcon = isPositive ? TrendingUp : (prediction.percentageChange < 0 ? TrendingDown : Minus);
  const trendColor = isPositive ? 'text-emerald-400' : 'text-red-400';
  const trendBg = isPositive ? 'from-emerald-500/10 to-transparent' : 'from-red-500/10 to-transparent';

  return (
    <div className={`card p-5 bg-gradient-to-br ${trendBg} border-slate-600`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">AI Target Price — {stockName}</p>
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-bold ${trendColor}`}>{formatINR(prediction.targetPrice)}</span>
            <span className={`text-lg font-semibold ${trendColor} flex items-center gap-1`}>
              <TrendIcon size={18} />
              {formatPct(prediction.percentageChange)}
            </span>
          </div>
          {previousClose > 0 && (
            <p className="text-xs text-slate-500 mt-1">Previous close: {formatINR(previousClose)}</p>
          )}
        </div>
        <RecBadge rec={prediction.recommendation} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-slate-500 text-xs mb-1 flex items-center gap-1"><Shield size={11} /> Stop Loss</p>
          <p className="text-red-400 font-semibold text-sm">{formatINR(prediction.stopLoss)}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-slate-500 text-xs mb-1 flex items-center gap-1"><TrendingDown size={11} /> Range Low</p>
          <p className="text-orange-400 font-semibold text-sm">{formatINR(prediction.priceRangeLow)}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-slate-500 text-xs mb-1 flex items-center gap-1"><TrendingUp size={11} /> Range High</p>
          <p className="text-emerald-400 font-semibold text-sm">{formatINR(prediction.priceRangeHigh)}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-slate-500 text-xs mb-1">Confidence</p>
          <ConfidenceDots level={prediction.confidence} />
        </div>
      </div>

      {(prediction.keyLevels) && (
        <div className="flex gap-4 mb-4 text-xs text-slate-400">
          <span>Support: <span className="text-emerald-400 font-medium">{formatINR(prediction.keyLevels?.support)}</span></span>
          <span>Resistance: <span className="text-red-400 font-medium">{formatINR(prediction.keyLevels?.resistance)}</span></span>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Technical:</span>
          <BiasTag bias={prediction.technicalBias} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Fundamental:</span>
          <BiasTag bias={prediction.fundamentalBias} />
        </div>
      </div>

      {prediction.summary && (
        <p className="text-slate-300 text-sm leading-relaxed border-t border-slate-700/50 pt-3 mb-3">
          {prediction.summary}
        </p>
      )}

      {prediction.reasoning?.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Key Reasoning</p>
          <ul className="space-y-1">
            {prediction.reasoning.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {prediction.riskFactors?.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Risk Factors</p>
          <ul className="space-y-1">
            {prediction.riskFactors.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <AlertTriangle size={13} className="text-yellow-500 mt-0.5 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MarkdownText({ text }) {
  if (!text) return <p className="text-slate-400 text-sm">No analysis available.</p>;
  // Simple markdown-like formatting
  const lines = text.split('\n');
  return (
    <div className="analysis-content space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('## ') || line.startsWith('**') && line.endsWith('**')) {
          return <h3 key={i} className="text-indigo-400 font-semibold mt-4 mb-1 text-sm">{line.replace(/^##\s+/, '').replace(/\*\*/g, '')}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={i} className="text-indigo-300 font-bold mt-4 mb-1">{line.replace(/^#\s+/, '')}</h2>;
        }
        if (line.match(/^\*\*(.+)\*\*$/)) {
          return <h3 key={i} className="text-indigo-400 font-semibold mt-3 mb-1 text-sm">{line.replace(/\*\*/g, '')}</h3>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <p key={i} className="text-slate-300 text-sm pl-3 flex gap-2"><span className="text-slate-600 shrink-0">•</span>{line.replace(/^[-*]\s+/, '').replace(/\*\*/g, '')}</p>;
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <p key={i} className="text-slate-300 text-sm leading-relaxed">{line.replace(/\*\*/g, '')}</p>;
      })}
    </div>
  );
}

function NewsCard({ item }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block card p-3 hover:border-slate-600 hover:bg-slate-800/50 transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-slate-200 text-sm font-medium leading-snug group-hover:text-indigo-300 transition-colors line-clamp-2">
            {item.title}
          </p>
          {item.description && (
            <p className="text-slate-500 text-xs mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
          )}
        </div>
        <ExternalLink size={13} className="text-slate-600 group-hover:text-slate-400 shrink-0 mt-0.5" />
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
        <span className="text-indigo-500">{item.source}</span>
        {item.publishedAt && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {new Date(item.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </a>
  );
}

const TABS = [
  { id: 'prediction', label: 'AI Prediction', icon: Brain },
  { id: 'technical', label: 'Technical', icon: BarChart2 },
  { id: 'fundamental', label: 'Fundamental', icon: TrendingUp },
  { id: 'news', label: 'News', icon: Newspaper },
];

export default function AnalysisResults({ result }) {
  const [activeTab, setActiveTab] = useState('prediction');

  if (!result) return null;
  const { stockName, stockData, news, technicalAnalysis, fundamentalAnalysis, finalPrediction, chartProvided } = result;

  return (
    <div className="space-y-4">
      {/* Stock info bar */}
      {stockData && (
        <div className="card p-4 flex flex-wrap items-center gap-4">
          <div>
            <p className="text-slate-400 text-xs">Stock</p>
            <p className="text-white font-bold text-lg">{stockData.name || stockName}</p>
            <p className="text-slate-500 text-xs">{stockData.symbol} · NSE</p>
          </div>
          <div className="flex flex-wrap gap-4 ml-auto">
            {[
              { label: 'LTP', value: formatINR(stockData.price) },
              { label: 'Prev Close', value: formatINR(stockData.previousClose) },
              { label: 'Change', value: `${stockData.changePercent >= 0 ? '+' : ''}${stockData.changePercent?.toFixed(2)}%`, color: stockData.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: "Day High", value: formatINR(stockData.high) },
              { label: "Day Low", value: formatINR(stockData.low) },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-slate-500 text-xs">{label}</p>
                <p className={`text-sm font-semibold ${color || 'text-white'}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1e293b] p-1 rounded-xl border border-slate-700/50 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center
              ${activeTab === id ? 'tab-active' : 'tab-inactive'}`}
          >
            <Icon size={14} />
            {label}
            {id === 'news' && news?.length > 0 && (
              <span className="bg-indigo-500/30 text-indigo-300 text-xs rounded-full px-1.5 ml-0.5">{news.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'prediction' && (
          <PredictionCard
            prediction={finalPrediction}
            stockName={stockName}
            previousClose={stockData?.previousClose || 0}
          />
        )}

        {activeTab === 'technical' && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={16} className="text-indigo-400" />
              <h3 className="font-semibold text-slate-200">Technical Chart Analysis</h3>
              {!chartProvided && (
                <span className="ml-auto text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2 py-0.5">
                  No chart uploaded
                </span>
              )}
            </div>
            <MarkdownText text={technicalAnalysis} />
          </div>
        )}

        {activeTab === 'fundamental' && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-indigo-400" />
              <h3 className="font-semibold text-slate-200">Fundamental & News Analysis</h3>
            </div>
            <MarkdownText text={fundamentalAnalysis} />
          </div>
        )}

        {activeTab === 'news' && (
          <div className="space-y-2">
            {!news || news.length === 0 ? (
              <div className="card p-5 text-center text-slate-400 text-sm">No news found for this stock.</div>
            ) : (
              news.map((item, i) => <NewsCard key={i} item={item} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
