import { useState, useEffect } from "react";
import api from "../../lib/api";

function BarChart({ data, maxVal }) {
  if (!data?.length) return null;
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d, i) => {
        const pct = maxVal > 0 ? (d.amount / maxVal) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              ₹{d.amount.toLocaleString("en-IN")}
            </div>
            <div className="w-full rounded-t-lg bg-indigo-100 group-hover:bg-indigo-200 transition-colors relative overflow-hidden" style={{ height: "100px" }}>
              <div
                className="absolute bottom-0 w-full bg-indigo-500 rounded-t-lg transition-all duration-700"
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-400 text-center leading-tight">{d.month.split(" ")[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBar({ category, amount, total }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  const colors = ["bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
  return null; // rendered inline below
}

export default function SpendInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/invoices/insights/spend")
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
      <div className="shimmer h-48 rounded-2xl" />
      <div className="shimmer h-48 rounded-2xl" />
    </div>
  );

  if (!data || (!data.monthly_spend?.length && !data.by_category?.length)) return null;

  const maxMonthly = Math.max(...(data.monthly_spend?.map(d => d.amount) || [1]));
  const totalCat = data.by_category?.reduce((s, c) => s + c.amount, 0) || 1;
  const catColors = ["bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-amber-400", "bg-rose-400", "bg-cyan-500"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
      {/* Monthly Spend Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Monthly Spend</h3>
            <p className="text-xs text-slate-400 mt-0.5">Accepted invoices only</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900 dark:text-white">₹{(data.total_spend / 100000).toFixed(1)}L</p>
            <p className="text-xs text-slate-400">total</p>
          </div>
        </div>
        {data.monthly_spend?.length > 0
          ? <BarChart data={data.monthly_spend} maxVal={maxMonthly} />
          : <div className="h-28 flex items-center justify-center text-xs text-slate-300">No data yet</div>
        }
      </div>

      {/* Category Breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">By Category</h3>
            <p className="text-xs text-slate-400 mt-0.5">{data.total_accepted} invoices accepted</p>
          </div>
        </div>
        <div className="space-y-3">
          {data.by_category?.slice(0, 5).map((cat, i) => {
            const pct = totalCat > 0 ? (cat.amount / totalCat) * 100 : 0;
            return (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${catColors[i % catColors.length]}`} />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{cat.category}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">₹{cat.amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${catColors[i % catColors.length]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {!data.by_category?.length && (
            <div className="text-center py-8 text-xs text-slate-300">No accepted invoices yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
