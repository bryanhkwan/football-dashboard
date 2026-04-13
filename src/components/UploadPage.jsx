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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-2xl mb-4">
          <span className="text-4xl">🏈</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Football Expense Dashboard</h1>
        <p className="text-slate-400 mt-2">
          Upload your player expense spreadsheet to populate the dashboard
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className={`
          w-full max-w-xl border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${dragging ? 'border-green-500 bg-green-500/10' : 'border-slate-600 bg-slate-800/50 hover:border-green-600 hover:bg-slate-800'}
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
            <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Parsing file…</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              {dragging ? (
                <FileSpreadsheet className="w-12 h-12 text-green-400" />
              ) : (
                <Upload className="w-12 h-12 text-slate-500" />
              )}
            </div>
            <p className="text-white font-semibold text-lg mb-1">
              {dragging ? 'Drop your file here' : 'Drag & drop your Excel file'}
            </p>
            <p className="text-slate-400 text-sm mb-4">or click to browse</p>
            <span className="text-xs text-slate-500 bg-slate-700 px-3 py-1 rounded-full">
              .xlsx · .xls
            </span>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 w-full max-w-xl flex items-start gap-3 bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Link back to existing dashboard */}
      {hasExistingData && !loading && (
        <button
          onClick={onViewDashboard}
          className="mt-6 flex items-center gap-2 text-green-400 hover:text-green-300 text-sm font-medium transition-colors"
        >
          View current dashboard <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {/* Expected columns reference */}
      <div className="mt-8 w-full max-w-xl bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Expected columns
        </h3>
        <div className="flex flex-wrap gap-2">
          {EXPECTED_COLUMNS.map((col) => (
            <span
              key={col}
              className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded"
            >
              {col}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
