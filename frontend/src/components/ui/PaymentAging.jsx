import { useState, useEffect } from "react";
import api from "../../lib/api";

const BUCKETS = [
  { key: "not_due", label: "Not Yet Due", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", barColor: "bg-emerald-400" },
  { key: "overdue_30", label: "1–30 Days Overdue", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", barColor: "bg-amber-400" },
  { key: "overdue_60", label: "31–60 Days Overdue", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", barColor: "bg-orange-500" },
  { key: "overdue_90", label: "61–90 Days Overdue", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", barColor: "bg-rose-500" },
  { key: "overdue_90_plus", label: "90+ Days Overdue", color: "text-rose-800", bg: "bg-rose-100", border: "border-rose-300", barColor: "bg-rose-700" },
];

function formatAmount(n) {
  if (!n) return "₹0";
  if (n >= 1e7) return `₹${(n/1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n/1e5).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function PaymentAging({ companyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = companyId ? `?company_id=${companyId}` : "";
    api.get(`/invoices/aging${params}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="shimmer h-36 rounded-2xl mb-6" />;
  if (!data) return null;

  const maxAmount = Math.max(...BUCKETS.map(b => data[b.key]?.total_amount || 0), 1);
  const totalUnpaid = BUCKETS.reduce((s, b) => s + (data[b.key]?.total_amount || 0), 0);
  const totalOverdue = BUCKETS.slice(1).reduce((s, b) => s + (data[b.key]?.total_amount || 0), 0);

  if (totalUnpaid === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Payables Aging</h3>
            <p className="text-xs text-slate-400">Unpaid accepted invoices · {formatAmount(totalUnpaid)} total</p>
          </div>
        </div>
        {totalOverdue > 0 && (
          <span className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full font-semibold">
            {formatAmount(totalOverdue)} overdue
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        {BUCKETS.map(bucket => {
          const bdata = data[bucket.key];
          if (!bdata || bdata.count === 0) return null;
          const pct = (bdata.total_amount / maxAmount) * 100;
          return (
            <div key={bucket.key}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${bucket.color}`}>{bucket.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{bdata.count} invoice{bdata.count !== 1 ? "s" : ""}</span>
                  <span className={`text-xs font-semibold ${bucket.color}`}>{formatAmount(bdata.total_amount)}</span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${bucket.barColor}`} style={{ width: `${Math.max(2, pct)}%` }} />
              </div>
              {bdata.invoices?.slice(0, 2).map(inv => (
                <div key={inv.id} className="flex items-center justify-between mt-1 ml-1">
                  <span className="text-[11px] text-slate-400 truncate max-w-[200px]">{inv.vendor_name || inv.file_name}</span>
                  <span className="text-[11px] text-slate-500 font-medium flex-shrink-0 ml-2">{formatAmount(inv.total_amount)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
