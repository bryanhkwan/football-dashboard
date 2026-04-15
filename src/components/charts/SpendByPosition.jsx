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

const COLORS = ['#FFD200', '#e6bd00', '#244f8f', '#173968', '#60a5fa', '#93c5fd', '#ffe58a'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[rgba(13,24,43,0.96)] px-3 py-2 text-sm shadow-xl backdrop-blur-sm">
      <p className="font-semibold text-[#f7fbff] mb-1">{label}</p>
      <p className="text-dash-accent font-bold">{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function SpendByPosition({ data }) {
  if (!data?.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="position"
          tick={{ fill: '#8ea4c5', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#8ea4c5', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v}`}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,210,0,0.06)' }} />
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
    <div className="h-60 flex items-center justify-center text-dash-muted text-sm">
      No data available
    </div>
  );
}
