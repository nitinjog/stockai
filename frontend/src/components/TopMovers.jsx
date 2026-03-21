import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

function formatPrice(p) {
  if (!p) return '—';
  return `₹${p.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatVolume(v) {
  if (!v) return '—';
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  return v.toLocaleString('en-IN');
}

function MoverCard({ stock, onSelect }) {
  const isPositive = stock.changePercent >= 0;
  return (
    <button
      onClick={() => onSelect(stock.symbol)}
      className="card p-3 text-left hover:border-indigo-500/50 hover:bg-slate-800/60 transition-all duration-200 group w-full"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">
          {stock.symbol}
        </span>
        <span className={`flex items-center gap-0.5 text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%
        </span>
      </div>
      <p className="text-slate-400 text-xs truncate mb-2 leading-tight">{stock.name}</p>
      <div className="flex items-end justify-between">
        <span className="text-white font-semibold text-sm">{formatPrice(stock.price)}</span>
        <span className={`text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{formatPrice(stock.change)}
        </span>
      </div>
      <p className="text-slate-600 text-xs mt-1">Vol: {formatVolume(stock.volume)}</p>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-3">
      <div className="skeleton h-4 w-16 rounded mb-2" />
      <div className="skeleton h-3 w-24 rounded mb-2" />
      <div className="skeleton h-5 w-20 rounded mb-1" />
      <div className="skeleton h-3 w-12 rounded" />
    </div>
  );
}

export default function TopMovers({ movers, loading, error, onSelect, onRefresh }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-200">Today's Top Movers</h2>
          <p className="text-xs text-slate-500">Nifty 50 — sorted by % movement. Click to analyze.</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 border border-slate-700 rounded-lg px-3 py-1.5"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
          : movers.map(stock => (
              <MoverCard key={stock.symbol} stock={stock} onSelect={onSelect} />
            ))}
      </div>
    </section>
  );
}
