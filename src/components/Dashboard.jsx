import { useMemo } from 'react';
import { Upload, DollarSign, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import StatCard from './StatCard';
import PlayerTable from './PlayerTable';
import SpendByPosition from './charts/SpendByPosition';
import SpendByYear from './charts/SpendByYear';
import CampusBreakdown from './charts/CampusBreakdown';
import ContractLengthChart from './charts/ContractLengthChart';
import {
  fmt,
  getStats,
  getSpendByPosition,
  getSpendByYear,
  getCampusBreakdown,
  getContractBreakdown,
} from '../utils/calculations';

function ChartCard({ title, children }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function Dashboard({ players, budget, onUploadNew, onClearData }) {
  const stats = useMemo(() => getStats(players, budget), [players, budget]);
  const spendByPosition = useMemo(() => getSpendByPosition(players), [players]);
  const spendByYear = useMemo(() => getSpendByYear(players), [players]);
  const campusBreakdown = useMemo(() => getCampusBreakdown(players), [players]);
  const contractBreakdown = useMemo(() => getContractBreakdown(players), [players]);

  const remainingClass =
    stats.remaining < 0
      ? 'text-red-400'
      : stats.remaining === 0
      ? 'text-slate-400'
      : 'text-green-400';

  const RemainingIcon =
    stats.remaining < 0 ? TrendingDown : stats.remaining === 0 ? Minus : TrendingUp;

  const budgetPct =
    stats.totalBudget > 0
      ? Math.min((stats.totalCommitted / stats.totalBudget) * 100, 100)
      : 0;

  const avgPerPlayer =
    stats.playerCount > 0 ? stats.totalCommitted / stats.playerCount : 0;

  return (
    <div className="min-h-screen">
      {/* Sticky nav */}
      <nav className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏈</span>
          <div>
            <h1 className="font-bold text-white leading-none">Football Dashboard</h1>
            <p className="text-xs text-slate-400">{players.length} players tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClearData}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
          >
            Clear data
          </button>
          <button
            onClick={onUploadNew}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload New File
          </button>
        </div>
      </nav>

      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Budget utilization bar */}
        {stats.totalBudget > 0 && (
          <div className="mb-6 bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400 font-medium">Budget Utilization</span>
              <span
                className={`text-sm font-bold ${
                  budgetPct >= 100 ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {budgetPct.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetPct >= 90
                    ? 'bg-red-500'
                    : budgetPct >= 70
                    ? 'bg-amber-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-slate-500">
              <span>{fmt(stats.totalCommitted)} committed</span>
              <span>{fmt(stats.totalBudget)} total budget</span>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Budget"
            value={fmt(stats.totalBudget)}
            sub={stats.totalBudget === 0 ? 'Not set in spreadsheet' : 'From uploaded file'}
            icon={DollarSign}
          />
          <StatCard
            label="Total Committed"
            value={fmt(stats.totalCommitted)}
            sub="Rev share + stipends"
            icon={DollarSign}
            valueClass="text-blue-400"
          />
          <StatCard
            label="Remaining Budget"
            value={fmt(Math.abs(stats.remaining))}
            sub={
              stats.remaining < 0
                ? 'Over budget'
                : stats.remaining === 0
                ? 'Fully allocated'
                : 'Available'
            }
            icon={RemainingIcon}
            valueClass={remainingClass}
          />
          <StatCard
            label="Players"
            value={stats.playerCount}
            sub={`avg ${fmt(avgPerPlayer)} / player`}
            icon={Users}
          />
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ChartCard title="Spend by Position">
            <SpendByPosition data={spendByPosition} />
          </ChartCard>
          <ChartCard title="Spend by Year">
            <SpendByYear data={spendByYear} />
          </ChartCard>
          <ChartCard title="Campus Breakdown">
            <CampusBreakdown data={campusBreakdown} />
          </ChartCard>
          <ChartCard title="Contract Length Distribution">
            <ContractLengthChart data={contractBreakdown} />
          </ChartCard>
        </div>

        {/* Player roster table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="font-semibold text-white mb-5 text-base">Player Roster</h2>
          <PlayerTable players={players} />
        </div>
      </div>
    </div>
  );
}
