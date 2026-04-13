import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { fmt } from '../utils/calculations';

const YEAR_ORDER = ['Fr', 'So', 'Jr', 'Sr'];

function Select({ value, onChange, placeholder, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 min-w-[140px]"
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
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
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

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-700/50 text-slate-400 uppercase text-xs tracking-wide">
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
          <tbody className="divide-y divide-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-500">
                  No players match your filters
                </td>
              </tr>
            ) : (
              filtered.map((p, idx) => (
                <tr
                  key={p.id}
                  className={idx % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800/20'}
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-4 py-3">
                    {p.position ? (
                      <span className="bg-green-900/40 text-green-400 px-2 py-0.5 rounded text-xs font-medium">
                        {p.position}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{p.year || '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{p.campus || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{fmt(p.revShare)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{fmt(p.stipend)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-400">
                    {fmt(p.totalCompensation)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.contractLength !== null ? (
                      <span className="bg-purple-900/40 text-purple-400 px-2 py-0.5 rounded text-xs font-medium">
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
              <tr className="bg-slate-700/60 text-white font-semibold border-t border-slate-600">
                <td className="px-4 py-3" colSpan={4}>
                  Total ({filtered.length} player{filtered.length !== 1 ? 's' : ''})
                </td>
                <td className="px-4 py-3 text-right">{fmt(totals.revShare)}</td>
                <td className="px-4 py-3 text-right">{fmt(totals.stipend)}</td>
                <td className="px-4 py-3 text-right text-green-400">{fmt(totals.total)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-2">
        {filtered.length} of {players.length} player{players.length !== 1 ? 's' : ''} shown
      </p>
    </div>
  );
}
