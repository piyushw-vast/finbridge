import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

const STATIC_ITEMS = [
  {
    id: "review-queue",
    type: "page",
    label: "Review Queue",
    sub: "Accountant invoice review dashboard",
    path: "/accountant/dashboard",
    roles: ["accountant", "firm_admin"],
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  {
    id: "company-dashboard",
    type: "page",
    label: "Company Dashboard",
    sub: "Invoice overview and status",
    path: "/company/dashboard",
    roles: ["company_admin", "company_user"],
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    id: "upload",
    type: "page",
    label: "Upload Invoice",
    sub: "Submit a new invoice for processing",
    path: "/company/upload",
    roles: ["company_admin", "company_user"],
    icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  },
  {
    id: "reports",
    type: "page",
    label: "Reports",
    sub: "MIS reports and financial summaries",
    path: "/reports",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    id: "gst-dashboard",
    type: "page",
    label: "GST Tax Dashboard",
    sub: "Input tax credit and CGST / SGST breakdown",
    path: "/reports/gst",
    icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z",
  },
  {
    id: "export-audit",
    type: "action",
    label: "Export Audit Report",
    sub: "Download all accepted invoices as a printable HTML report",
    icon: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    id: "high-risk",
    type: "filter",
    label: "High Risk Invoices",
    sub: "Show invoices with trust score below 60",
    path: "/accountant/dashboard",
    roles: ["accountant", "firm_admin"],
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
  {
    id: "fraud-signals",
    type: "filter",
    label: "Fraud Signal Report",
    sub: "View all detected behavioral anomalies",
    path: "/accountant/dashboard",
    roles: ["accountant", "firm_admin"],
    icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  },
];

function fuzzyScore(query, text) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return 2;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 1 : 0;
}

function scoreItem(query, item) {
  if (!query) return 1;
  return Math.max(
    fuzzyScore(query, item.label),
    fuzzyScore(query, item.sub || ""),
    item.type === "invoice" ? fuzzyScore(query, item.vendor || "") : 0,
    item.type === "invoice" ? fuzzyScore(query, item.invoice_number || "") : 0,
  );
}

function TrustPill({ score }) {
  if (score == null) return null;
  const cls = score >= 85 ? "bg-emerald-50 text-emerald-700" : score >= 60 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cls}`}>{score}/100</span>;
}

export default function CommandPalette({ onExportAudit }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Global Cmd+K
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // On open: fetch invoices, focus input
  useEffect(() => {
    if (!open) { setQuery(""); setSelected(0); return; }
    setLoadingInvoices(true);
    api.get("/invoices?limit=100")
      .then((r) => setInvoices(r.data))
      .catch(() => {})
      .finally(() => setLoadingInvoices(false));
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Build results
  const filteredStatic = STATIC_ITEMS.filter((item) => {
    if (item.roles && !item.roles.includes(user?.role)) return false;
    return scoreItem(query, item) > 0;
  });

  const filteredInvoices = invoices
    .map((inv) => ({
      id: inv.id,
      key: `inv-${inv.id}`,
      type: "invoice",
      label: inv.file_name,
      sub: inv.invoice_type?.replace(/_/g, " "),
      vendor: inv.transaction?.vendor_name || "",
      invoice_number: inv.transaction?.invoice_number || "",
      trust_score: inv.trust_score,
      status: inv.status,
      path: user?.role === "accountant" || user?.role === "firm_admin"
        ? `/accountant/review/${inv.id}`
        : `/company/invoice/${inv.id}`,
    }))
    .filter((item) => scoreItem(query, item) > 0)
    .sort((a, b) => scoreItem(query, b) - scoreItem(query, a))
    .slice(0, 6);

  const groups = [];
  if (filteredStatic.length > 0) groups.push({ label: "Actions & Pages", items: filteredStatic });
  if (filteredInvoices.length > 0) groups.push({ label: "Invoices", items: filteredInvoices });

  const flat = groups.flatMap((g) => g.items);

  function select(item) {
    setOpen(false);
    if (item.type === "action" && item.id === "export-audit") {
      onExportAudit?.();
      return;
    }
    if (item.path) navigate(item.path);
  }

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (!open) return;
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, flat.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter") { e.preventDefault(); if (flat[selected]) select(flat[selected]); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, flat, selected]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  let globalIdx = 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      <div className="relative w-full max-w-xl bg-white dark:bg-slate-800 dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            placeholder="Search invoices, vendors, actions…"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white dark:text-white placeholder-slate-400 focus:outline-none min-w-0"
          />
          {loadingInvoices && (
            <svg className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <kbd className="hidden sm:flex text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded font-mono items-center gap-0.5 flex-shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto overscroll-contain">
          {flat.length === 0 && !loadingInvoices ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">No results for <span className="font-medium text-slate-600 dark:text-slate-300">"{query}"</span></p>
              <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Try searching for a vendor name or invoice number</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 pt-3 pb-1.5">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const idx = globalIdx++;
                  const isSelected = idx === selected;
                  return (
                    <button
                      key={item.key || item.id}
                      data-idx={idx}
                      onClick={() => select(item)}
                      onMouseEnter={() => setSelected(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-900/30"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        item.type === "invoice"
                          ? "bg-slate-100 dark:bg-slate-800"
                          : item.type === "action"
                          ? "bg-indigo-50 dark:bg-indigo-900/40"
                          : "bg-slate-100 dark:bg-slate-800"
                      }`}>
                        {item.icon ? (
                          <svg className={`w-4 h-4 ${item.type === "action" ? "text-indigo-500" : "text-slate-500 dark:text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </div>

                      {/* Label + sub */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white dark:text-white truncate">{item.label}</p>
                        {(item.sub || item.vendor) && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                            {item.vendor ? `${item.vendor}${item.sub ? " · " + item.sub : ""}` : item.sub}
                          </p>
                        )}
                      </div>

                      {/* Trust score for invoices */}
                      {item.type === "invoice" && <TrustPill score={item.trust_score} />}

                      {/* Enter hint */}
                      {isSelected && (
                        <kbd className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded font-mono flex-shrink-0">↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint bar */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          {[
            { keys: ["↑", "↓"], label: "navigate" },
            { keys: ["↵"], label: "open" },
            { keys: ["esc"], label: "close" },
          ].map(({ keys, label }) => (
            <div key={label} className="flex items-center gap-1 text-[10px] text-slate-400">
              {keys.map((k) => (
                <kbd key={k} className="bg-white dark:bg-slate-800 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded font-mono shadow-sm">
                  {k}
                </kbd>
              ))}
              <span className="ml-0.5">{label}</span>
            </div>
          ))}
          <span className="ml-auto text-[10px] text-slate-300 dark:text-slate-600">FinBridge</span>
        </div>
      </div>
    </div>
  );
}
