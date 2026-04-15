import { CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { fmt } from '../utils/calculations';

function SummaryCard({ label, value, valueClass = 'text-[#f7fbff]' }) {
  return (
    <div className="dash-card p-4 relative z-[1]">
      <p className="text-[10px] font-bold text-dash-muted uppercase tracking-[0.08em] mb-1">{label}</p>
      <p className={`text-xl font-extrabold ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function ImportPreview({ data, onConfirm, onCancel }) {
  const { players, totalBudget, errors, fileName, sheetName } = data;
  const totalCommitted = players.reduce((s, p) => s + p.totalCompensation, 0);

  return (
    <div className="min-h-screen px-4 py-10 max-w-5xl mx-auto animate-fade-up">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <FileSpreadsheet className="w-6 h-6 text-dash-accent" />
          <h1 className="text-2xl font-extrabold text-[#f8fbff] tracking-tight">Import Preview</h1>
        </div>
        <p className="text-dash-muted text-sm ml-9">
          {fileName} · Sheet: <span className="text-[#dce6f4]">{sheetName}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Players Found" value={players.length} />
        <SummaryCard
          label="Total Budget"
          value={totalBudget !== null ? fmt(totalBudget) : 'Not found'}
          valueClass="text-status-good"
        />
        <SummaryCard
          label="Total Committed"
          value={fmt(totalCommitted)}
          valueClass="text-dash-blue-2"
        />
        <SummaryCard
          label="Warnings"
          value={errors.length}
          valueClass={errors.length > 0 ? 'text-status-warn' : 'text-dash-muted'}
        />
      </div>

      {errors.length > 0 && (
        <div className="mb-6 rounded-dash border border-status-warn/30 bg-[rgba(251,191,36,0.08)] p-4">
          <div className="flex items-center gap-2 mb-2 text-status-warn font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            {errors.length} warning{errors.length !== 1 ? 's' : ''} — rows will still be imported
          </div>
          <ul className="text-sm text-amber-100/90 space-y-1 ml-6">
            {errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="dash-card overflow-hidden mb-8 relative z-[1] p-0">
        <div className="px-5 py-3 border-b border-white/[0.06] bg-[rgba(255,210,0,0.03)] flex items-center justify-between">
          <h2 className="font-bold text-[#f7fbff] text-sm">Player Rows ({players.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#9db1ce] bg-gradient-to-b from-[rgba(18,31,52,0.95)] to-[rgba(9,17,30,0.95)] border-b border-[rgba(255,210,0,0.15)]">
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
            <tbody>
              {players.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-b border-white/[0.05] ${
                    i % 2 === 0 ? 'bg-[rgba(255,255,255,0.02)]' : ''
                  }`}
                >
                  <td className="px-4 py-2 font-semibold text-[#f4f8ff]">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-4 py-2 text-[#dce6f4]">{p.position || '—'}</td>
                  <td className="px-4 py-2 text-[#dce6f4]">{p.year || '—'}</td>
                  <td className="px-4 py-2 text-[#dce6f4]">{p.campus || '—'}</td>
                  <td className="px-4 py-2 text-right text-[#dce6f4]">{fmt(p.revShare)}</td>
                  <td className="px-4 py-2 text-right text-[#dce6f4]">{fmt(p.stipend)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-status-good">
                    {fmt(p.totalCompensation)}
                  </td>
                  <td className="px-4 py-2 text-center text-[#dce6f4]">
                    {p.contractLength !== null ? `${p.contractLength}mo` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-[10px] border border-dash-line text-dash-muted hover:bg-white/[0.05] hover:text-dash-fg hover:border-white/15 transition-colors text-sm font-bold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={players.length === 0}
          className="btn-primary-dash disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:brightness-100"
        >
          <CheckCircle className="w-4 h-4" />
          Confirm Import
        </button>
      </div>
    </div>
  );
}
