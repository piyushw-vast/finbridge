import { useState, useEffect } from "react";
import api from "../../lib/api";

export default function ConfidenceTrend() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/invoices/insights/confidence-trend")
      .then(r => setData(r.data))
      .catch(() => {});
  }, []);

  if (!data) return <div className="shimmer h-40 rounded-2xl" />;

  const trend = data.trend || [];
  const maxScore = 100;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">AI Confidence Trend</h2>
          <p className="text-xs text-slate-400 mt-0.5">Average trust score per day — last 30 days</p>
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <p className="text-xl font-bold text-indigo-600">{data.avg_trust_score}</p>
            <p className="text-xs text-slate-400">Avg Score</p>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-600">{data.auto_accepted_rate}%</p>
            <p className="text-xs text-slate-400">Auto-accepted</p>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{data.total_processed}</p>
            <p className="text-xs text-slate-400">Processed</p>
          </div>
        </div>
      </div>

      {trend.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-3">No data yet for the last 30 days</p>
      ) : (
        <div className="flex items-end gap-1.5 h-24">
          {trend.map((d, i) => {
            const pct = (d.avg_trust / maxScore) * 100;
            const color = d.avg_trust >= 85 ? "bg-emerald-400" : d.avg_trust >= 60 ? "bg-amber-400" : "bg-rose-400";
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {d.date}: {d.avg_trust}/100
                </div>
                <div className="w-full rounded-t-sm" style={{ height: `${pct}%`, minHeight: "4px" }}>
                  <div className={`w-full h-full ${color} rounded-t-sm opacity-80 group-hover:opacity-100 transition-opacity`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4 mt-3">
        {[["bg-emerald-400", "≥85 Auto-accepted"], ["bg-amber-400", "60–84 Review"], ["bg-rose-400", "<60 High risk"]].map(([bg, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${bg}`} />
            <span className="text-xs text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
