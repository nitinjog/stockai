import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Building2 } from 'lucide-react';
import { searchStocks } from '../api/index.js';

export default function StockSearch({ value, onChange }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInput = (val) => {
    setQuery(val);
    onChange(val.toUpperCase());
    clearTimeout(debounceRef.current);
    if (val.length < 2) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchStocks(val);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const handleSelect = (stock) => {
    setQuery(stock.symbol);
    onChange(stock.symbol);
    setSuggestions([]);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-slate-300 mb-2">
        Stock Symbol / Name
      </label>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="e.g. RELIANCE, TCS, HDFC..."
          className="w-full bg-[#1e293b] border border-slate-700 rounded-lg pl-9 pr-9 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading
            ? <Loader2 size={16} className="animate-spin text-slate-500" />
            : query && <button onClick={handleClear}><X size={16} className="text-slate-500 hover:text-slate-300" /></button>
          }
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 card shadow-xl border-slate-600 overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.fullSymbol}
              onClick={() => handleSelect(s)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 transition-colors text-left"
            >
              <Building2 size={14} className="text-indigo-400 shrink-0" />
              <div>
                <span className="text-white text-sm font-medium">{s.symbol}</span>
                <span className="text-slate-400 text-xs ml-2">{s.name}</span>
              </div>
              <span className="ml-auto text-xs text-slate-600">{s.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
