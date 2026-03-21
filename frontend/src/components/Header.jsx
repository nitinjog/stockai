import { TrendingUp, Zap } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b border-slate-700/50 bg-[#0f172a]/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-none">StockAI</h1>
            <p className="text-xs text-slate-400">Indian Market Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Zap size={13} className="text-indigo-400" />
          <span>Powered by Gemini AI</span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline">NSE · BSE</span>
        </div>
      </div>
    </header>
  );
}
