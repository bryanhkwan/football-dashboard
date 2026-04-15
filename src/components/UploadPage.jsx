import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, ArrowRight } from 'lucide-react';
import { parseExcelFile } from '../utils/excelParser';

const EXPECTED_COLUMNS = [
  'Last Name',
  'First Name',
  'Position',
  'Year',
  'On/Off Campus',
  'Rev Share $',
  'Contract Length',
  'Stipend',
  'Total Compensation',
  'Total Budget',
];

export default function UploadPage({ onParsed, hasExistingData, onViewDashboard }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(
    async (file) => {
      if (!file.name.match(/\.xlsx?$/i)) {
        setError('Please upload an Excel file (.xlsx or .xls)');
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const result = await parseExcelFile(file);
        onParsed(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [onParsed]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 animate-fade-up">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-gradient-to-br from-[rgba(255,210,0,0.18)] to-[rgba(36,79,143,0.22)] border border-white/[0.08]">
          <span className="text-4xl">🏈</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          <span className="inline-flex items-center px-[11px] py-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] text-[10px] font-extrabold tracking-[0.14em] uppercase text-[#cad7ea]">
            Toledo Football Ops
          </span>
          <span className="inline-flex items-center px-[11px] py-1.5 rounded-full border border-dash-accent/25 bg-gradient-to-br from-[rgba(255,210,0,0.18)] to-[rgba(255,210,0,0.08)] text-[10px] font-extrabold tracking-[0.14em] uppercase text-dash-accent">
            Import
          </span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#f8fbff] tracking-tight">Football Expense Dashboard</h1>
        <p className="text-dash-muted mt-2 max-w-lg mx-auto leading-relaxed">
          Upload your player expense spreadsheet to populate the dashboard
        </p>
      </div>

      <div
        className={`
          w-full max-w-xl border-2 border-dashed rounded-dash p-12 text-center cursor-pointer
          transition-all duration-200
          ${
            dragging
              ? 'border-dash-accent bg-[rgba(255,210,0,0.08)]'
              : 'border-white/[0.12] bg-[rgba(13,24,43,0.35)] hover:border-dash-accent/50 hover:bg-[rgba(255,210,0,0.04)]'
          }
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleInputChange}
          disabled={loading}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-dash-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-dash-muted text-sm">Parsing file…</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              {dragging ? (
                <FileSpreadsheet className="w-12 h-12 text-dash-accent" />
              ) : (
                <Upload className="w-12 h-12 text-dash-muted" />
              )}
            </div>
            <p className="text-[#f7fbff] font-semibold text-lg mb-1">
              {dragging ? 'Drop your file here' : 'Drag & drop your Excel file'}
            </p>
            <p className="text-dash-muted text-sm mb-4">or click to browse</p>
            <span className="text-xs text-dash-muted bg-[rgba(5,11,20,0.5)] border border-white/[0.06] px-3 py-1 rounded-full">
              .xlsx · .xls
            </span>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 w-full max-w-xl flex items-start gap-3 rounded-dash border border-status-bad/35 bg-[rgba(248,113,113,0.08)] px-4 py-3 text-sm text-red-200">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-status-bad" />
          {error}
        </div>
      )}

      {hasExistingData && !loading && (
        <button
          type="button"
          onClick={onViewDashboard}
          className="mt-6 flex items-center gap-2 text-dash-accent hover:text-[#ffe58a] text-sm font-bold transition-colors"
        >
          View current dashboard <ArrowRight className="w-4 h-4" />
        </button>
      )}

      <div className="mt-8 w-full max-w-xl dash-card p-5 relative z-[1]">
        <h3 className="text-[10.5px] font-bold text-dash-muted uppercase tracking-[0.08em] mb-3">
          Expected columns
        </h3>
        <div className="flex flex-wrap gap-2">
          {EXPECTED_COLUMNS.map((col) => (
            <span
              key={col}
              className="text-xs bg-[rgba(255,255,255,0.04)] text-[#dce6f4] px-2 py-1 rounded-lg border border-white/[0.06]"
            >
              {col}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
