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
    <div className="dash-card p-5 relative z-[1]">
      <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-dash-muted mb-4 pl-3 border-l-[3px] border-dash-accent/40">
        {title}
      </h3>
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
      ? 'text-status-bad'
      : stats.remaining === 0
      ? 'text-dash-muted'
      : 'text-status-good';

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
      <nav className="dash-nav px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-[240px]">
          <span className="text-2xl leading-none mt-0.5" aria-hidden>
            🏈
          </span>
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="inline-flex items-center px-[11px] py-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] text-[10px] font-extrabold tracking-[0.14em] uppercase text-[#cad7ea]">
                Toledo Football Ops
              </span>
              <span className="inline-flex items-center px-[11px] py-1.5 rounded-full border border-dash-accent/25 bg-gradient-to-br from-[rgba(255,210,0,0.18)] to-[rgba(255,210,0,0.08)] text-[10px] font-extrabold tracking-[0.14em] uppercase text-dash-accent">
                Expense board
              </span>
            </div>
            <h1 className="text-[27px] font-extrabold tracking-tight text-[#f8fbff] leading-tight">
              Football Dashboard
            </h1>
            <p className="text-xs text-dash-muted mt-2 max-w-xl leading-relaxed opacity-90">
              {players.length} players tracked · Rev share, stipends, and roster spend in one view.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button type="button" onClick={onClearData} className="btn-ghost-dash">
            Clear data
          </button>
          <button type="button" onClick={onUploadNew} className="btn-primary-dash">
            <Upload className="w-4 h-4" />
            Upload New File
          </button>
        </div>
      </nav>

      <div className="px-6 py-8 max-w-[1540px] mx-auto">
        {stats.totalBudget > 0 && (
          <div className="dash-card p-5 mb-6 relative z-[1]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-[0.06em] text-dash-muted">
                Budget utilization
              </span>
              <span
                className={`text-sm font-extrabold ${
                  budgetPct >= 100 ? 'text-status-bad' : 'text-status-good'
                }`}
              >
                {budgetPct.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-[rgba(5,11,20,0.55)] border border-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetPct >= 90
                    ? 'bg-gradient-to-r from-status-bad to-red-400'
                    : budgetPct >= 70
                    ? 'bg-gradient-to-r from-dash-accent to-dash-accent-dark'
                    : 'bg-gradient-to-r from-status-good to-emerald-400'
                }`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[11px] text-dash-muted">
              <span>{fmt(stats.totalCommitted)} committed</span>
              <span>{fmt(stats.totalBudget)} total budget</span>
            </div>
          </div>
        )}

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
            valueClass="text-dash-blue-2"
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

        <div className="dash-card p-6 relative z-[1]">
          <div className="px-4 py-2.5 -mx-6 -mt-6 mb-5 border-b border-dash-line border-l-[3px] border-l-dash-accent/50 bg-[rgba(255,210,0,0.03)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-dash-muted">
              Player roster
            </p>
            <h2 className="text-sm font-extrabold text-[#f7fbff] mt-1">Roster & compensation</h2>
          </div>
          <PlayerTable players={players} />
        </div>
      </div>
    </div>
  );
}
