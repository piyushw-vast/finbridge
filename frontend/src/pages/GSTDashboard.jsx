import { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

function fmt(v) {
  if (!v && v !== 0) return "—";
  return "₹" + Number(v).toLocaleString("en-IN");
}

function StatCard({ label, value, sub, color }) {
  const colors = {
    indigo: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400",
    emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
    violet: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
    amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  };
  return (
    <div className={`rounded-2xl p-5 ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-2">{label}</p>
      <p className="text-2xl font-bold font-mono">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  );
}

export default function GSTDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/invoices/gst-summary")
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const maxMonthTotal = data ? Math.max(...data.monthly.map((m) => m.total), 1) : 1;
  const maxVendorTotal = data ? Math.max(...data.by_vendor.map((v) => v.total), 1) : 1;

  return (
    <Layout>
      <div className="px-8 py-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white dark:text-white">GST Tax Dashboard</h1>
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                India GST
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Input tax credit across all accepted invoices · CGST / SGST / IGST breakdown
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="shimmer h-28 rounded-2xl" />)}
          </div>
        ) : !data ? (
          <div className="text-center py-20 text-slate-400">Could not load GST data</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Total Input Credit"
                value={fmt(data.total_input_credit)}
                sub={`${data.invoice_count} accepted invoices`}
                color="indigo"
              />
              <StatCard
                label="CGST Paid"
                value={fmt(data.total_cgst)}
                sub="Central GST"
                color="emerald"
              />
              <StatCard
                label="SGST Paid"
                value={fmt(data.total_sgst)}
                sub="State GST"
                color="violet"
              />
              <StatCard
                label="IGST Paid"
                value={fmt(data.total_igst)}
                sub="Integrated GST"
                color="amber"
              />
            </div>

            {/* Filing readiness banner */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-5 py-4 mb-8 flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {fmt(data.total_input_credit)} eligible for input tax credit claim
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                  All invoices verified by Autonomous Verification Pipeline — GST numbers validated · tax math cross-checked
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Monthly breakdown */}
              <div className="bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white dark:text-white mb-1">Monthly Breakdown</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">Total input credit per month</p>

                {data.monthly.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No monthly data yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.monthly.map((m) => (
                      <div key={m.month}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 dark:text-slate-300">
                            {m.label || m.month}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white dark:text-white font-mono">
                            {fmt(m.total)}
                          </span>
                        </div>
                        <div className="h-5 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                            style={{ width: `${Math.max((m.total / maxMonthTotal) * 100, 4)}%` }}
                          >
                            {m.total / maxMonthTotal > 0.25 && (
                              <span className="text-[9px] text-white font-semibold">{m.count} inv</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">CGST {fmt(m.cgst)}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">SGST {fmt(m.sgst)}</span>
                          {m.igst > 0 && <span className="text-[10px] text-slate-400 dark:text-slate-500">IGST {fmt(m.igst)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* By vendor */}
              <div className="bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white dark:text-white mb-1">Top Vendors by GST</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">Input credit contribution per vendor</p>

                {data.by_vendor.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No vendor data yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.by_vendor.map((v, i) => (
                      <div key={v.vendor}>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[10px] font-bold text-slate-400 w-4 flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 dark:text-slate-300 truncate">{v.vendor}</span>
                              <span className="text-xs font-semibold text-slate-900 dark:text-white dark:text-white font-mono ml-2 flex-shrink-0">{fmt(v.total)}</span>
                            </div>
                            <div className="mt-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
                                style={{ width: `${Math.max((v.total / maxVendorTotal) * 100, 4)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3 pl-7">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{v.count} invoice{v.count !== 1 ? "s" : ""}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">CGST {fmt(v.cgst)}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">SGST {fmt(v.sgst)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Full table */}
            {data.monthly.length > 0 && (
              <div className="mt-6 bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-700">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white dark:text-white">GST Filing Summary</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Month-wise CGST / SGST / IGST ready for GSTR-2 filing</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        {["Month", "Invoices", "Invoice Total", "CGST", "SGST", "IGST", "Total Credit"].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.monthly.map((m, i) => (
                        <tr key={m.month} className={`border-b border-slate-50 dark:border-slate-800 ${i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-900/20"}`}>
                          <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200 dark:text-slate-300">{m.label || m.month}</td>
                          <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{m.count}</td>
                          <td className="px-5 py-3 font-mono text-slate-700 dark:text-slate-200 dark:text-slate-300">{fmt(m.invoice_total)}</td>
                          <td className="px-5 py-3 font-mono text-emerald-700 dark:text-emerald-400">{fmt(m.cgst)}</td>
                          <td className="px-5 py-3 font-mono text-violet-700 dark:text-violet-400">{fmt(m.sgst)}</td>
                          <td className="px-5 py-3 font-mono text-amber-700 dark:text-amber-400">{fmt(m.igst)}</td>
                          <td className="px-5 py-3 font-mono font-semibold text-slate-900 dark:text-white dark:text-white">{fmt(m.total)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 dark:bg-slate-900/40 font-semibold">
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-200 dark:text-slate-300">Total</td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{data.invoice_count}</td>
                        <td className="px-5 py-3 font-mono text-slate-700 dark:text-slate-200 dark:text-slate-300">—</td>
                        <td className="px-5 py-3 font-mono text-emerald-700 dark:text-emerald-400">{fmt(data.total_cgst)}</td>
                        <td className="px-5 py-3 font-mono text-violet-700 dark:text-violet-400">{fmt(data.total_sgst)}</td>
                        <td className="px-5 py-3 font-mono text-amber-700 dark:text-amber-400">{fmt(data.total_igst)}</td>
                        <td className="px-5 py-3 font-mono text-indigo-700 dark:text-indigo-400 text-base">{fmt(data.total_input_credit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
