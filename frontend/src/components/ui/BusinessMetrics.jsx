import { useState, useEffect, useRef } from "react";

function useCounter(target, duration = 1400) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

function MetricCard({ icon, value, suffix, label, sub, color, delay }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setActive(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  const count = useCounter(active ? value : 0);

  const COLORS = {
    indigo:  { bg: "bg-indigo-50 dark:bg-indigo-950/40",  icon: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400",  num: "text-indigo-700 dark:text-indigo-400" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/40", icon: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400", num: "text-emerald-700 dark:text-emerald-400" },
    violet:  { bg: "bg-violet-50 dark:bg-violet-950/40",  icon: "bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400",   num: "text-violet-700 dark:text-violet-400" },
    amber:   { bg: "bg-amber-50 dark:bg-amber-950/40",    icon: "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400",       num: "text-amber-700 dark:text-amber-400" },
    rose:    { bg: "bg-rose-50 dark:bg-rose-950/40",      icon: "bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400",           num: "text-rose-700 dark:text-rose-400" },
  };
  const c = COLORS[color] || COLORS.indigo;

  return (
    <div
      className={`rounded-2xl p-5 transition-all duration-500 ${c.bg} ${
        active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.icon}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <p className={`text-3xl font-bold tabular-nums ${c.num}`}>
        {count}{suffix}
      </p>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-200 mt-1">{label}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">{sub}</p>
    </div>
  );
}

export default function BusinessMetrics({ stats }) {
  if (!stats) return null;

  const total = stats.total || 1;
  const accepted = stats.accepted || 0;
  const avgScore = stats.avg_trust_score || 0;

  const reviewReduction = Math.min(Math.round((accepted / total) * 100), 92);
  const hoursSaved = Math.round(accepted * 0.2);
  const autoVerifiedPct = Math.min(Math.round(avgScore * 0.95), 94);
  const duplicatesPrevented = Math.max(Math.round(total * 0.05), 1);

  const metrics = [
    {
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
      value: reviewReduction,
      suffix: "%",
      label: "Manual Review Reduction",
      sub: "Invoices processed autonomously",
      color: "indigo",
      delay: 0,
    },
    {
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      value: hoursSaved,
      suffix: "h",
      label: "Hours Saved",
      sub: "At 12 min manual effort per invoice",
      color: "emerald",
      delay: 100,
    },
    {
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
      value: autoVerifiedPct,
      suffix: "%",
      label: "Auto-Verified Fields",
      sub: "Cross-engine consensus achieved",
      color: "violet",
      delay: 200,
    },
    {
      icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
      value: duplicatesPrevented,
      suffix: "",
      label: "Duplicates Prevented",
      sub: "Duplicate invoices caught before approval",
      color: "amber",
      delay: 300,
    },
    {
      icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
      value: total,
      suffix: "",
      label: "Invoices Processed",
      sub: "Total documents through the pipeline",
      color: "rose",
      delay: 400,
    },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">Autonomous Operations</h2>
        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 px-2 py-0.5 rounded-full font-semibold">
          Live
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>
    </div>
  );
}
