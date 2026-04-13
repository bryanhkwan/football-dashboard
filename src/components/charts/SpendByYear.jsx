import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { fmt } from '../../utils/calculations';

const COLORS = ['#3b82f6', '#2563eb', '#60a5fa', '#1d4ed8', '#93c5fd'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      <p className="text-blue-400">{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function SpendByYear({ data }) {
  if (!data?.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v}`}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={60}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyState() {
  return (
    <div className="h-60 flex items-center justify-center text-slate-500 text-sm">
      No data available
    </div>
  );
}
