import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { exportAuditReport } from "../lib/auditExport";

async function downloadReport(reportId, fileName) {
  const res = await api.get(`/reports/${reportId}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "report.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

function DownloadButton({ reportId, fileName }) {
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    try { await downloadReport(reportId, fileName); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }
  return (
    <button
      onClick={handle}
      disabled={loading}
      className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200 text-sm font-medium px-3 py-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
    >
      {loading ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
      {loading ? "…" : "PDF"}
    </button>
  );
}

function fmt(v) {
  if (!v && v !== 0) return "—";
  const n = Number(v);
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(2) + "Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(2) + "L";
  return "₹" + n.toLocaleString("en-IN");
}

function Badge({ type }) {
  const map = {
    mis: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
    balance_sheet: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    profit_loss: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    cash_flow: "bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
    gst_summary: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    other: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
  };
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize ${map[type] || map.other}`}>
      {type?.replace(/_/g, " ")}
    </span>
  );
}

function ReportSummaryPanel({ data }) {
  if (!data) return null;
  const maxCat = Math.max(...(data.categories || []).map(c => c.amount), 1);
  const maxVend = Math.max(...(data.top_vendors || []).map(v => v.amount), 1);

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Spend", value: fmt(data.total_spend), color: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" },
          { label: "GST Input Credit", value: fmt(data.gst_input_credit), color: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
          { label: "Invoices Processed", value: `${data.accepted ?? data.total_invoices} / ${data.total_invoices}`, color: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400" },
          { label: "Avg Trust Score", value: data.avg_trust_score ? `${data.avg_trust_score}%` : "—", color: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-3 ${k.color}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">{k.label}</p>
            <p className="text-lg font-bold font-mono">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Categories + Vendors side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Spend by Category */}
        {data.categories?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Spend by Category</p>
            <div className="space-y-2">
              {data.categories.map(c => (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-700 dark:text-slate-200 dark:text-slate-300 truncate max-w-[60%]">{c.name}</span>
                    <span className="text-xs font-semibold font-mono text-slate-800 dark:text-slate-100 dark:text-slate-200">{fmt(c.amount)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                      style={{ width: `${Math.max((c.amount / maxCat) * 100, 3)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{c.pct}% of total</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Vendors */}
        {data.top_vendors?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Top Vendors</p>
            <div className="space-y-2">
              {data.top_vendors.map((v, i) => (
                <div key={v.name} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 w-4 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-700 dark:text-slate-200 dark:text-slate-300 truncate">{v.name}</span>
                      <span className="text-xs font-semibold font-mono text-slate-800 dark:text-slate-100 dark:text-slate-200 ml-2 flex-shrink-0">{fmt(v.amount)}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                        style={{ width: `${Math.max((v.amount / maxVend) * 100, 3)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Monthly trend */}
      {data.monthly?.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Monthly Trend</p>
          <div className="flex items-end gap-2 h-16">
            {data.monthly.map(m => {
              const maxM = Math.max(...data.monthly.map(x => x.spend), 1);
              const pct = Math.max((m.spend / maxM) * 100, 8);
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-mono text-slate-500">{fmt(m.spend)}</span>
                  <div className="w-full bg-violet-200 dark:bg-violet-800/50 rounded-t" style={{ height: `${pct * 0.4}px` }} />
                  <span className="text-[9px] text-slate-400 whitespace-nowrap">{m.month.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GST split */}
      {data.gst_split && (
        <div className="flex gap-3 flex-wrap">
          {[
            { k: "cgst", label: "CGST", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" },
            { k: "sgst", label: "SGST", color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30" },
            { k: "igst", label: "IGST", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30" },
          ].map(g => (
            <div key={g.k} className={`rounded-xl px-3 py-2 text-center ${g.color}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{g.label}</p>
              <p className="text-sm font-bold font-mono">{fmt(data.gst_split[g.k])}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cash flow */}
      {data.cash_flow && (
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Cash Flow Summary</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Opening", val: data.cash_flow.opening },
              { label: "Inflows", val: data.cash_flow.inflows, plus: true },
              { label: "Outflows", val: data.cash_flow.outflows, minus: true },
              { label: "Closing", val: data.cash_flow.closing, bold: true },
            ].map(cf => (
              <div key={cf.label}>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{cf.label}</p>
                <p className={`text-xs font-semibold font-mono mt-0.5 ${cf.plus ? "text-emerald-600 dark:text-emerald-400" : cf.minus ? "text-rose-600 dark:text-rose-400" : cf.bold ? "text-slate-900 dark:text-white dark:text-white" : "text-slate-700 dark:text-slate-200 dark:text-slate-300"}`}>
                  {cf.plus ? "+" : cf.minus ? "−" : ""}{fmt(cf.val)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Highlights */}
      {data.highlights?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Key Highlights</p>
          {data.highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
              {h}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ title: "", report_type: "mis", company_id: "", description: "", period_start: "", period_end: "" });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const canUpload = ["accountant", "firm_admin"].includes(user?.role);

  async function handleExport() {
    setExporting(true);
    try { await exportAuditReport(api, user); }
    catch (e) { console.error(e); }
    finally { setExporting(false); }
  }

  useEffect(() => {
    fetchReports();
    if (canUpload) {
      api.get("/companies/").then(r => setCompanies(r.data)).catch(() => {});
    }
  }, []);

  async function fetchReports() {
    try {
      const res = await api.get("/reports");
      setReports(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      Object.entries(form).forEach(([k, v]) => v && formData.append(k, v));
      await api.post("/reports/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await fetchReports();
      setShowUpload(false);
      setFile(null);
    } catch (e) {
      setError(e.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white dark:text-white">Reports</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">MIS reports and financial summaries</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <button
              onClick={() => navigate("/reports/gst")}
              className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5 rounded-xl font-medium text-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
              </svg>
              GST Dashboard
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exporting ? "Generating…" : "Export Audit Report"}
            </button>
            {canUpload && (
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Report
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="shimmer h-24 rounded-2xl" />)}</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <svg className="w-14 h-14 mx-auto text-slate-200 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-slate-700 dark:text-slate-200 dark:text-slate-300 font-semibold">No reports yet</p>
            {canUpload && <p className="text-slate-400 text-sm mt-1">Upload your first MIS report</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(r => {
              const isOpen = expanded === r.id;
              return (
                <div key={r.id} className="bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden transition-all">
                  {/* Header row */}
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white truncate">{r.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge type={r.report_type} />
                          {r.period_start && r.period_end && (
                            <span className="text-xs text-slate-400">
                              {new Date(r.period_start).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                              {" — "}
                              {new Date(r.period_end).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                            </span>
                          )}
                          <span className="text-xs text-slate-300 dark:text-slate-600">{new Date(r.created_at).toLocaleDateString("en-IN")}</span>
                        </div>
                        {r.description && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 line-clamp-1">{r.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {r.summary_data && (
                        <button
                          onClick={() => setExpanded(isOpen ? null : r.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                            isOpen
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100"
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" />
                          </svg>
                          {isOpen ? "Hide Summary" : "View Summary"}
                        </button>
                      )}
                      <DownloadButton reportId={r.id} fileName={r.file_name} />
                    </div>
                  </div>

                  {/* Expanded summary panel */}
                  {isOpen && r.summary_data && (
                    <div className="px-5 pb-5 border-t border-slate-50 dark:border-slate-700/50">
                      <ReportSummaryPanel data={r.summary_data} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 sticky top-0 bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-t-2xl border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white dark:text-white">Upload Report</h2>
              <button onClick={() => setShowUpload(false)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-all text-xl">×</button>
            </div>
            <form onSubmit={handleUpload} className="space-y-3 px-6 py-5">
              {canUpload && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Company</label>
                  <select required value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400">
                    <option value="">Select company...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {[
                { key: "title", label: "Report Title", required: true },
                { key: "description", label: "Description" },
                { key: "period_start", label: "Period Start", type: "date" },
                { key: "period_end", label: "Period End", type: "date" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{f.label}</label>
                  <input type={f.type || "text"} required={f.required} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Report Type</label>
                <select value={form.report_type} onChange={e => setForm(p => ({ ...p, report_type: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400">
                  <option value="mis">MIS Report</option>
                  <option value="balance_sheet">Balance Sheet</option>
                  <option value="profit_loss">Profit & Loss</option>
                  <option value="cash_flow">Cash Flow</option>
                  <option value="gst_summary">GST Summary</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">File (PDF / Excel)</label>
                <input type="file" required accept=".pdf,.xlsx,.xls,.csv"
                  onChange={e => setFile(e.target.files[0])}
                  className="w-full text-sm text-slate-600 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 file:font-medium" />
              </div>
              {error && <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-sm text-rose-700 dark:text-rose-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowUpload(false)} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">Cancel</button>
                <button type="submit" disabled={uploading || !file} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
