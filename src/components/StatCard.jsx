export default function StatCard({ label, value, sub, valueClass = 'text-white', icon: Icon }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          {label}
        </span>
        {Icon && <Icon className="w-4 h-4 text-slate-500" />}
      </div>
      <span className={`text-3xl font-bold tracking-tight ${valueClass}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500 mt-0.5">{sub}</span>}
    </div>
  );
}
