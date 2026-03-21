import { useState, useRef } from 'react';
import { Upload, ImagePlus, X, CheckCircle2 } from 'lucide-react';

export default function ChartUpload({ onFileChange }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return;
    setFile(f);
    onFileChange(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        Technical Chart Image{' '}
        <span className="text-slate-500 font-normal">(optional — JPG/PNG, max 10MB)</span>
      </label>

      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
            ${dragging
              ? 'border-indigo-400 bg-indigo-500/10'
              : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'
            }`}
        >
          <ImagePlus size={32} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 text-sm font-medium mb-1">
            Drop your chart here or <span className="text-indigo-400">browse</span>
          </p>
          <p className="text-slate-600 text-xs">
            Upload a screenshot from TradingView, Zerodha Kite, or any charting platform
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="card p-3 relative">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button
              onClick={handleClear}
              className="text-slate-500 hover:text-red-400 transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>
          {preview && (
            <img
              src={preview}
              alt="Chart preview"
              className="w-full max-h-48 object-contain rounded-lg bg-slate-900"
            />
          )}
        </div>
      )}
    </div>
  );
}
