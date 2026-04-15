import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { fmt } from '../utils/calculations';

const YEAR_ORDER = ['Fr', 'So', 'Jr', 'Sr'];

function Select({ value, onChange, placeholder, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-dash min-w-[140px]"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export default function PlayerTable({ players }) {
  const [search, setSearch] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterCampus, setFilterCampus] = useState('');

  const positions = useMemo(
    () => [...new Set(players.map((p) => p.position).filter(Boolean))].sort(),
    [players]
  );

  const years = useMemo(() => {
    const unique = [...new Set(players.map((p) => p.year).filter(Boolean))];
    return unique.sort((a, b) => {
      const ai = YEAR_ORDER.indexOf(a);
      const bi = YEAR_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [players]);

  const campuses = useMemo(
    () => [...new Set(players.map((p) => p.campus).filter(Boolean))].sort(),
    [players]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return players.filter((p) => {
      if (q && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(q)) return false;
      if (filterPosition && p.position !== filterPosition) return false;
      if (filterYear && p.year !== filterYear) return false;
      if (filterCampus && p.campus !== filterCampus) return false;
      return true;
    });
  }, [players, search, filterPosition, filterYear, filterCampus]);

  const totals = useMemo(
    () => ({
      revShare: filtered.reduce((s, p) => s + p.revShare, 0),
      stipend: filtered.reduce((s, p) => s + p.stipend, 0),
      total: filtered.reduce((s, p) => s + p.totalCompensation, 0),
    }),
    [filtered]
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted" />
          <input
            type="text"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dash w-full pl-9 pr-3 py-2 placeholder:text-dash-muted/70"
          />
        </div>
        <Select
          value={filterPosition}
          onChange={setFilterPosition}
          placeholder="All Positions"
          options={positions}
        />
        <Select
          value={filterYear}
          onChange={setFilterYear}
          placeholder="All Years"
          options={years}
        />
        <Select
          value={filterCampus}
          onChange={setFilterCampus}
          placeholder="All Housing"
          options={campuses}
        />
      </div>

      <div className="overflow-x-auto rounded-dash border border-white/[0.08] bg-[rgba(5,11,20,0.22)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#9db1ce] bg-gradient-to-b from-[rgba(18,31,52,0.98)] to-[rgba(9,17,30,0.98)] border-b border-[rgba(255,210,0,0.18)] shadow-[inset_0_-1px_0_rgba(255,210,0,0.14)]">
              <th className="text-left px-4 py-3">Player</th>
              <th className="text-left px-4 py-3">Position</th>
              <th className="text-left px-4 py-3">Year</th>
              <th className="text-left px-4 py-3">Housing</th>
              <th className="text-right px-4 py-3">Rev Share</th>
              <th className="text-right px-4 py-3">Stipend</th>
              <th className="text-right px-4 py-3">Total Comp</th>
              <th className="text-center px-4 py-3">Contract</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-dash-muted text-sm">
                  No players match your filters
                </td>
              </tr>
            ) : (
              filtered.map((p, idx) => (
                <tr
                  key={p.id}
                  className={`border-b border-white/[0.035] transition-colors hover:bg-[rgba(255,210,0,0.04)] ${
                    idx % 2 === 0 ? 'bg-[rgba(255,255,255,0.016)]' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-semibold text-[#f4f8ff]">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-4 py-3">
                    {p.position ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold text-dash-accent bg-[rgba(255,210,0,0.1)] border border-[rgba(255,210,0,0.22)]">
                        {p.position}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#dce6f4]">{p.year || '—'}</td>
                  <td className="px-4 py-3 text-[#dce6f4]">{p.campus || '—'}</td>
                  <td className="px-4 py-3 text-right text-[#dce6f4]">{fmt(p.revShare)}</td>
                  <td className="px-4 py-3 text-right text-[#dce6f4]">{fmt(p.stipend)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-status-good">
                    {fmt(p.totalCompensation)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.contractLength !== null ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold text-[#c4b5fd] bg-[rgba(139,92,246,0.12)] border border-[rgba(139,92,246,0.28)]">
                        {p.contractLength}mo
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="bg-[rgba(18,31,52,0.55)] text-[#f7fbff] font-semibold border-t border-white/[0.08]">
                <td className="px-4 py-3" colSpan={4}>
                  Total ({filtered.length} player{filtered.length !== 1 ? 's' : ''})
                </td>
                <td className="px-4 py-3 text-right">{fmt(totals.revShare)}</td>
                <td className="px-4 py-3 text-right">{fmt(totals.stipend)}</td>
                <td className="px-4 py-3 text-right text-status-good">{fmt(totals.total)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-dash-muted mt-2">
        {filtered.length} of {players.length} player{players.length !== 1 ? 's' : ''} shown
      </p>
    </div>
  );
}
