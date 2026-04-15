export default function StatCard({ label, value, sub, valueClass = 'text-dash-fg', icon: Icon }) {
  return (
    <div className="dash-card p-5 flex flex-col gap-1 relative z-[1]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-bold text-dash-muted uppercase tracking-[0.08em]">
          {label}
        </span>
        {Icon && <Icon className="w-4 h-4 text-dash-muted/80" />}
      </div>
      <span className={`text-3xl font-extrabold tracking-tight ${valueClass}`}>{value}</span>
      {sub && <span className="text-xs text-dash-muted mt-0.5">{sub}</span>}
    </div>
  );
}
