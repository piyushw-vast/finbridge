import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import TrustScoreBadge from "../../components/ui/TrustScoreBadge";
import StatusBadge from "../../components/ui/StatusBadge";
import ConfidenceTrend from "../../components/ui/ConfidenceTrend";
import FraudSignals from "../../components/ui/FraudSignals";
import BusinessMetrics from "../../components/ui/BusinessMetrics";
import api from "../../lib/api";
import { useToast } from "../../components/ui/Toast";

export default function AccountantDashboard() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("review");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [bulkAccepting, setBulkAccepting] = useState(false);

  useEffect(() => {
    fetchData();
    setSelected(new Set());
  }, [filter]);

  useEffect(() => {
    const pending = stats ? (stats.under_review ?? 0) + (stats.needs_correction ?? 0) : 0;
    document.title = pending > 0 ? `(${pending}) FinBridge` : "FinBridge";
    return () => { document.title = "FinBridge"; };
  }, [stats]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const [invRes, statsRes] = await Promise.all([
        api.get(`/invoices${params}`),
        api.get("/invoices/stats/summary"),
      ]);
      setInvoices(invRes.data);
      setStats(statsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkAccept() {
    setBulkAccepting(true);
    const count = selected.size;
    try {
      await api.post("/invoices/bulk-accept", { invoice_ids: [...selected] });
      setSelected(new Set());
      showToast(`${count} invoice${count !== 1 ? "s" : ""} approved in bulk`);
      fetchData();
    } catch (e) { console.error(e); }
    finally { setBulkAccepting(false); }
  }

  const filterTabs = [
    { key: "review", label: "Needs Review", color: "text-blue-600" },
    { key: "needs_correction", label: "Needs Correction", color: "text-orange-600" },
    { key: "accepted", label: "Accepted", color: "text-green-600" },
    { key: "all", label: "All", color: "text-gray-600" },
  ];

  function formatTimeSaved(acceptedCount) {
    const mins = (acceptedCount || 0) * 15;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs === 0) return `${rem}m`;
    if (rem === 0) return `${hrs}h`;
    return `${hrs}h ${rem}m`;
  }

  const STAT_CONFIG = [
    { label: "Needs Review", value: stats ? (stats.under_review ?? 0) + (stats.needs_correction ?? 0) : 0, numColor: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "High Risk", value: stats?.high_risk ?? 0, numColor: "text-rose-600", bg: "bg-rose-50" },
    { label: "Accepted", value: stats?.accepted ?? 0, numColor: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Avg Trust Score", value: stats ? `${stats.avg_trust_score ?? 0}/100` : "—", numColor: "text-slate-900", bg: "bg-slate-100" },
    { label: "Time Saved", value: stats ? formatTimeSaved(stats.accepted) : "—", numColor: "text-violet-600", bg: "bg-violet-50" },
  ];

  return (
    <Layout>
      <div className="px-8 py-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Review Queue</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Sorted by risk level — high risk invoices appear first</p>
        </div>

        {/* Stats */}
        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-2">
              {STAT_CONFIG.map(s => (
                <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 text-center">
                  <p className={`text-2xl font-bold ${s.numColor}`}>{s.value}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-600 mb-6 text-right">Estimated at 15 min manual review per invoice</p>
          </>
        )}

        {/* Live ₹ Ticker */}
        {stats?.total_spend > 0 && (
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl px-6 py-5 mb-6 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-1">Total Processed</p>
              <p className="text-white text-3xl font-bold tracking-tight">
                ₹{Number(stats.total_spend).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-indigo-200 text-xs mt-1">{stats.accepted} accepted invoice{stats.accepted !== 1 ? "s" : ""} · {formatTimeSaved(stats.accepted)} of manual work automated</p>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-white/20 text-6xl font-black select-none">₹</div>
            </div>
          </div>
        )}

        {/* Business Value Metrics */}
        <BusinessMetrics stats={stats} />

        {/* Fraud Signals */}
        <FraudSignals />

        {/* Confidence Trend */}
        <ConfidenceTrend />

        {/* Filter tabs */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-6 w-fit">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${filter === tab.key ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(() => {
          const autoSafe = invoices.filter(inv => inv.trust_score >= 85 && !inv.conflicts?.length && !inv.is_duplicate);
          if (filter === "review" && autoSafe.length > 0) return (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 mb-4">
              <div className="w-7 h-7 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="text-sm text-emerald-700 flex-1">
                <span className="font-semibold">{autoSafe.length} invoice{autoSafe.length !== 1 ? "s" : ""}</span> pre-screened safe by AI — trust ≥ 85, no conflicts
              </p>
              <button
                onClick={() => setSelected(new Set(autoSafe.map(i => i.id)))}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex-shrink-0"
              >
                Select all AI-safe
              </button>
            </div>
          );
          return null;
        })()}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="shimmer h-20 rounded-2xl" />)}
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <svg className="w-12 h-12 mx-auto text-slate-200 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-700 dark:text-slate-300 font-semibold">All caught up!</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">No invoices in this queue</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              const vendorCounts = {};
              invoices.forEach(inv => { if (inv.vendor_name) vendorCounts[inv.vendor_name] = (vendorCounts[inv.vendor_name] || 0) + 1; });
              return invoices.map(inv => {
                const vendorCount = inv.vendor_name ? vendorCounts[inv.vendor_name] : 0;
                return (
                  <div
                    key={inv.id}
                    className={`bg-white dark:bg-slate-800 rounded-2xl border p-5 hover:shadow-sm transition-all cursor-pointer group
                      ${inv.risk_level === "high_risk" ? "border-rose-200 dark:border-rose-900 hover:border-rose-300" :
                        inv.risk_level === "review" ? "border-amber-200 dark:border-amber-900 hover:border-amber-300" : "border-slate-100 dark:border-slate-700 hover:border-indigo-200"}`}
                    onClick={() => navigate(`/accountant/review/${inv.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {(filter === "review" || filter === "all") && (
                          <input
                            type="checkbox"
                            checked={selected.has(inv.id)}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              e.stopPropagation();
                              setSelected(prev => {
                                const next = new Set(prev);
                                if (next.has(inv.id)) next.delete(inv.id);
                                else next.add(inv.id);
                                return next;
                              });
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 flex-shrink-0 cursor-pointer"
                          />
                        )}
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          inv.risk_level === "high_risk" ? "bg-rose-500" :
                          inv.risk_level === "review" ? "bg-amber-400" : "bg-emerald-500"
                        }`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{inv.file_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-slate-400 capitalize">{inv.invoice_type?.replace("_", " ")}</p>
                            {inv.vendor_name && vendorCount > 1 && (
                              <span className="text-[10px] bg-violet-50 text-violet-600 border border-violet-100 px-1.5 py-0.5 rounded-full font-medium">
                                {vendorCount}× vendor
                              </span>
                            )}
                            {inv.vendor_name && vendorCount === 1 && (
                              <span className="text-[10px] bg-slate-50 text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded-full font-medium">
                                New vendor
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        {inv.conflicts?.length > 0 && (
                          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                            {inv.conflicts.length} conflict{inv.conflicts.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {inv.trust_score >= 90 && !inv.conflicts?.length && !inv.is_duplicate && (
                          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
                            ✓ Auto-approvable
                          </span>
                        )}
                        {inv.trust_score >= 75 && !inv.conflicts?.length && (
                          <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-full font-medium">
                            Trusted
                          </span>
                        )}
                        <TrustScoreBadge score={inv.trust_score} />
                        <StatusBadge status={inv.status} />
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-2xl px-5 py-3 flex items-center gap-4 shadow-xl z-50">
          <span className="text-sm font-medium">{selected.size} invoice{selected.size > 1 ? "s" : ""} selected</span>
          <button
            onClick={handleBulkAccept}
            disabled={bulkAccepting}
            className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-all"
          >
            {bulkAccepting ? "Accepting..." : "Bulk Accept"}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-slate-400 hover:text-white text-sm">Clear</button>
        </div>
      )}
    </Layout>
  );
}
