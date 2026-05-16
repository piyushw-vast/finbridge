import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import TrustScoreBadge from "../../components/ui/TrustScoreBadge";
import StatusBadge from "../../components/ui/StatusBadge";
import SpendInsights from "../../components/ui/SpendInsights";
import FraudSignals from "../../components/ui/FraudSignals";
import PaymentAging from "../../components/ui/PaymentAging";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

const STAT_CONFIG = [
  { key: "total",        label: "Total",        icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", bg: "bg-slate-100", color: "text-slate-500", num: "text-slate-900" },
  { key: "pending",      label: "Pending",      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", bg: "bg-slate-100", color: "text-slate-400", num: "text-slate-600" },
  { key: "under_review", label: "Under Review", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z", bg: "bg-indigo-50", color: "text-indigo-500", num: "text-indigo-600" },
  { key: "accepted",     label: "Accepted",     icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", bg: "bg-emerald-50", color: "text-emerald-500", num: "text-emerald-600" },
  { key: "rejected",     label: "Rejected",     icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z", bg: "bg-rose-50", color: "text-rose-400", num: "text-rose-600" },
  { key: "total_spend",  label: "Total Spend",  icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v1m-8-5a8 8 0 1116 0 8 8 0 01-16 0z", bg: "bg-emerald-50", color: "text-emerald-500", num: "text-emerald-700" },
];

function getStageLabel(stage) {
  return { queued: "Queued", preprocessing: "Preprocessing", extracting: "Extracting", validating: "Validating", scoring: "Scoring" }[stage] || stage;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function timeToReview(inv) {
  if (inv.status !== "accepted" && inv.status !== "rejected") {
    const diff = Date.now() - new Date(inv.created_at).getTime();
    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor(diff / 3600000);
    if (days > 0) return { label: `${days}d pending`, color: "text-amber-500" };
    if (hrs > 0) return { label: `${hrs}h pending`, color: "text-slate-400" };
    return { label: "Just uploaded", color: "text-slate-400" };
  }
  if (inv.reviewed_at) {
    const diff = new Date(inv.reviewed_at).getTime() - new Date(inv.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    const label = days > 0 ? `${inv.status === "accepted" ? "Accepted" : "Reviewed"} in ${days}d`
      : hrs > 0 ? `${inv.status === "accepted" ? "Accepted" : "Reviewed"} in ${hrs}h`
      : `${inv.status === "accepted" ? "Accepted" : "Reviewed"} in ${mins}m`;
    return { label, color: inv.status === "accepted" ? "text-emerald-500" : "text-rose-400" };
  }
  return null;
}

const PAGE_SIZE = 20;

export default function CompanyDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, company, refreshCompany } = useAuth();
  const logoInputRef = useRef(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") || "all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const params = {};
    if (search) params.q = search;
    if (statusFilter !== "all") params.status = statusFilter;
    setSearchParams(params, { replace: true });
  }, [search, statusFilter]);

  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if ((e.key === "u" || e.key === "U") && !e.metaKey && !e.ctrlKey) {
        navigate("/company/upload");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [page]);

  async function fetchData() {
    try {
      const [invRes, statsRes] = await Promise.all([
        api.get(`/invoices?skip=${page * PAGE_SIZE}&limit=${PAGE_SIZE}&paginate=true`),
        api.get("/invoices/stats/summary"),
      ]);
      const items = Array.isArray(invRes.data) ? invRes.data : invRes.data.items || invRes.data;
      setInvoices(items);
      setHasMore(items.length === PAGE_SIZE);
      setStats(statsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file || !user?.company_id) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/companies/${user.company_id}/logo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      refreshCompany({ ...company, logo_url: res.data.logo_url });
    } catch (e) { console.error(e); }
    finally { setUploadingLogo(false); }
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {/* Company Logo */}
            <div className="relative group">
              <div
                onClick={() => logoInputRef.current?.click()}
                className="w-14 h-14 rounded-2xl overflow-hidden bg-indigo-50 border-2 border-slate-100 hover:border-indigo-300 cursor-pointer transition-all flex items-center justify-center"
                title="Click to change company logo"
              >
                {company?.logo_url ? (
                  <img src={company.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-indigo-400">
                    {(company?.name || user?.full_name || "C")[0].toUpperCase()}
                  </span>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <svg className="w-4 h-4 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{company?.name || "Invoices"}</h1>
              <p className="text-slate-500 text-sm mt-0.5">Upload and track your financial documents</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                const res = await api.get("/invoices/export/csv", { responseType: "blob" });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement("a"); a.href = url;
                a.download = "invoices_export.csv"; a.click();
                window.URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-medium text-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => navigate("/company/upload")}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Invoice
              <kbd className="text-[10px] bg-indigo-500 px-1.5 py-0.5 rounded font-mono">U</kbd>
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            {STAT_CONFIG.map(s => (
              <div key={s.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <svg className={`w-4.5 h-4.5 ${s.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                  </svg>
                </div>
                <p className={`text-2xl font-bold ${s.num}`}>
                  {s.key === "total_spend"
                    ? `₹${((stats[s.key] || 0) / 100000).toFixed(1)}L`
                    : stats[s.key] ?? 0}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Fraud Signals */}
        <FraudSignals companyId={user?.company_id} />

        {/* Payment Aging */}
        <PaymentAging companyId={user?.company_id} />

        {/* Spend Insights */}
        <SpendInsights />

        {/* Search + Filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="needs_correction">Needs Correction</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-5 py-4 border-b border-slate-50 flex gap-4 items-center">
                <div className="shimmer h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="shimmer h-4 w-48 rounded-lg" />
                <div className="shimmer h-4 w-20 rounded-lg ml-8" />
                <div className="shimmer h-6 w-24 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Top gradient bar */}
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600" />
            <div className="py-16 px-8 text-center max-w-lg mx-auto">
              {/* Animated icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-100">
                <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Your AI pipeline is ready</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Drop your first invoice and watch FinBridge autonomously extract, validate, and trust-score it across three AI engines — in under 20 seconds.
              </p>
              {/* Steps */}
              <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
                {["Upload", "AI Extracts", "Trust Scored", "Accountant Reviews"].map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">{s}</span>
                    {i < 3 && <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>}
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate("/company/upload")}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl text-sm font-semibold transition-all shadow-lg shadow-indigo-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Upload First Invoice
              </button>
              <p className="text-xs text-slate-400 mt-4">Supports PDF, JPG, PNG · Processed in ~14 seconds</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Document", "Type", "Status", "Trust Score", "Uploaded", "Timeline", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices
                  .filter(inv => {
                    const q = search.toLowerCase();
                    const matchSearch = !q ||
                      inv.file_name?.toLowerCase().includes(q) ||
                      inv.invoice_type?.toLowerCase().includes(q);
                    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
                    return matchSearch && matchStatus;
                  })
                  .map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => navigate(`/company/invoice/${inv.id}`)}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <svg className="w-4.5 h-4.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="font-medium text-slate-800 truncate max-w-[180px]">{inv.file_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-500 capitalize text-xs bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                        {inv.invoice_type?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {inv.processing_status && !["complete", "failed"].includes(inv.processing_status) ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full font-medium">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                            {getStageLabel(inv.processing_status)}
                          </span>
                        ) : (
                          <StatusBadge status={inv.status} />
                        )}
                        {inv.is_duplicate && (
                          <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Duplicate</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4"><TrustScoreBadge score={inv.trust_score} /></td>
                    <td className="px-5 py-4 text-slate-400 text-xs">{formatDate(inv.created_at)}</td>
                    <td className="px-5 py-4">
                      {(() => { const t = timeToReview(inv); return t ? <span className={`text-xs font-medium ${t.color}`}>{t.label}</span> : null; })()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(page > 0 || hasMore) && (
          <div className="flex items-center justify-between mt-4 px-1">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="text-sm text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 font-medium">
              ← Previous
            </button>
            <span className="text-xs text-slate-400">Page {page + 1}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={!hasMore}
              className="text-sm text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 font-medium">
              Next →
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
