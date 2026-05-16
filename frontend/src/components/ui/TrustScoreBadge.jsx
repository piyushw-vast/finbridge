const TOOLTIP = "Computed from: field confidence (40%) · cross-engine consensus (30%) · validation checks (20%) · duplicate similarity (10%)";

function getColors(score) {
  if (score >= 85) return { stroke: "#10b981", text: "text-emerald-600", label: "Safe" };
  if (score >= 60) return { stroke: "#f59e0b", text: "text-amber-600", label: "Review" };
  return { stroke: "#f43f5e", text: "text-rose-500", label: "Risk" };
}

export default function TrustScoreBadge({ score, size = "sm" }) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
        Processing...
      </span>
    );
  }

  const { stroke, text, label } = getColors(score);

  if (size === "lg") {
    const r = 40;
    const circ = 2 * Math.PI * r;
    const filled = (score / 100) * circ;
    return (
      <div className="flex flex-col items-center gap-1 group relative" title={TOOLTIP}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <style>{`
            @keyframes sweep-${Math.round(score)} {
              from { stroke-dasharray: 0 ${circ}; }
              to   { stroke-dasharray: ${filled} ${circ}; }
            }
          `}</style>
          <circle cx="48" cy="48" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle
            cx="48" cy="48" r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeDasharray={`${filled} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            style={{ animation: `sweep-${Math.round(score)} 1.2s ease-out forwards` }}
          />
          <text x="48" y="44" textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="700" fill="#0f172a">{score.toFixed(0)}</text>
          <text x="48" y="62" textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#94a3b8">/ 100</text>
        </svg>
        <span className={`text-sm font-semibold ${text}`}>{label}</span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 bg-slate-900 text-slate-200 text-xs rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center leading-relaxed">
          {TOOLTIP}
        </div>
      </div>
    );
  }

  const dotColors = { Safe: "bg-emerald-500", Review: "bg-amber-500", Risk: "bg-rose-500" };
  const pillColors = {
    Safe: "bg-emerald-50 text-emerald-700",
    Review: "bg-amber-50 text-amber-700",
    Risk: "bg-rose-50 text-rose-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${pillColors[label]} cursor-help`}
      title={TOOLTIP}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[label]}`} />
      {score.toFixed(0)}/100 · {label}
    </span>
  );
}
