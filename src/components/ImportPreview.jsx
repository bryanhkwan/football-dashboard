import { CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { fmt } from '../utils/calculations';

function SummaryCard({ label, value, valueClass = 'text-white' }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function ImportPreview({ data, onConfirm, onCancel }) {
  const { players, totalBudget, errors, fileName, sheetName } = data;
  const totalCommitted = players.reduce((s, p) => s + p.totalCompensation, 0);

  return (
    <div className="min-h-screen px-4 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <FileSpreadsheet className="w-6 h-6 text-green-400" />
          <h1 className="text-2xl font-bold text-white">Import Preview</h1>
        </div>
        <p className="text-slate-400 text-sm ml-9">
          {fileName} · Sheet: <span className="text-slate-300">{sheetName}</span>
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Players Found" value={players.length} />
        <SummaryCard
          label="Total Budget"
          value={totalBudget !== null ? fmt(totalBudget) : 'Not found'}
          valueClass="text-green-400"
        />
        <SummaryCard
          label="Total Committed"
          value={fmt(totalCommitted)}
          valueClass="text-blue-400"
        />
        <SummaryCard
          label="Warnings"
          value={errors.length}
          valueClass={errors.length > 0 ? 'text-amber-400' : 'text-slate-400'}
        />
      </div>

      {/* Warnings */}
      {errors.length > 0 && (
        <div className="mb-6 bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-400 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            {errors.length} warning{errors.length !== 1 ? 's' : ''} — rows will still be imported
          </div>
          <ul className="text-sm text-amber-300 space-y-1 ml-6">
            {errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Player preview table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-8">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">
            Player Rows ({players.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 uppercase tracking-wide bg-slate-700/40">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Position</th>
                <th className="text-left px-4 py-2">Year</th>
                <th className="text-left px-4 py-2">Housing</th>
                <th className="text-right px-4 py-2">Rev Share</th>
                <th className="text-right px-4 py-2">Stipend</th>
                <th className="text-right px-4 py-2">Total</th>
                <th className="text-center px-4 py-2">Contract</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {players.map((p, i) => (
                <tr
                  key={p.id}
                  className={i % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/50'}
                >
                  <td className="px-4 py-2 font-medium text-white">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{p.position || '—'}</td>
                  <td className="px-4 py-2 text-slate-300">{p.year || '—'}</td>
                  <td className="px-4 py-2 text-slate-300">{p.campus || '—'}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{fmt(p.revShare)}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{fmt(p.stipend)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-green-400">
                    {fmt(p.totalCompensation)}
                  </td>
                  <td className="px-4 py-2 text-center text-slate-300">
                    {p.contractLength !== null ? `${p.contractLength}mo` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={players.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors text-sm"
        >
          <CheckCircle className="w-4 h-4" />
          Confirm Import
        </button>
      </div>
    </div>
  );
}
