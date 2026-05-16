export default function FieldConfidence({ label, value, confidence, flagged, conflict }) {
  const conf = confidence ?? 0;
  const pct = Math.round(conf * 100);

  let confColor, barColor, icon;
  if (flagged || conf < 0.6) {
    confColor = conf === 0 ? "text-rose-500" : "text-amber-600";
    barColor = conf === 0 ? "bg-rose-400" : "bg-amber-400";
    icon = conf === 0 ? "✗" : "⚠";
  } else if (conf >= 0.85) {
    confColor = "text-emerald-600";
    barColor = "bg-emerald-500";
    icon = "✓";
  } else {
    confColor = "text-amber-600";
    barColor = "bg-amber-400";
    icon = "~";
  }

  return (
    <div className={`py-2 border-b border-slate-50 last:border-0 ${flagged ? "bg-amber-50/50 -mx-1 px-1 rounded-lg" : ""}`}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <span className={`text-[10px] font-semibold ${confColor} flex items-center gap-0.5`}>
          <span>{icon}</span> {pct}%
        </span>
      </div>
      <p className={`text-xs font-medium truncate ${value ? "text-slate-700 dark:text-slate-200" : "text-slate-300 italic"}`}>
        {value ?? "Not extracted"}
      </p>
      {conflict && (
        <p className="text-[10px] text-amber-600 mt-0.5 truncate">⚠ {conflict}</p>
      )}
      <div className="mt-1.5 h-0.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
