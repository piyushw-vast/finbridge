import { useState, useEffect } from "react";
import api from "../../lib/api";

const SEVERITY_CONFIG = {
  high: { color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500", label: "High" },
  medium: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400", label: "Medium" },
  low: { color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400", label: "Low" },
};

function buildWhyFlagged(signals) {
  const types = new Set(signals.map(s => s.signal));
  const reasons = [];
  if (types.has("duplicate_invoice_number")) reasons.push("a duplicate invoice number");
  if (types.has("invalid_gst")) reasons.push("an invalid GST format");
  if (types.has("amount_anomaly")) reasons.push("an unusual invoice amount");
  if (types.has("round_amount")) reasons.push("a suspiciously round total");
  if (types.has("future_date")) reasons.push("a future-dated invoice");
  if (types.has("weekend_date")) reasons.push("weekend invoice issuance");
  if (types.has("stale_invoice")) reasons.push("an overdue submission date");
  if (types.has("tax_math_inconsistency")) reasons.push("a tax calculation mismatch");
  if (types.has("low_confidence")) reasons.push("low AI extraction confidence");
  if (reasons.length === 0) return null;
  if (reasons.length === 1) return `Flagged because of ${reasons[0]}.`;
  const last = reasons[reasons.length - 1];
  return `Flagged because of ${reasons.slice(0, -1).join(", ")} and ${last}.`;
}

const SIGNAL_LABELS = {
  invalid_gst: "Tax ID does not match PAN-based GST format",
  round_amount: "Invoice total is an unusually round number — atypical for this vendor",
  future_date: "Invoice date is set in the future — chronological anomaly",
  stale_invoice: "Invoice predates 12 months — outside normal submission window",
  weekend_date: "Invoice issued on a weekend — inconsistent with vendor business patterns",
  duplicate_invoice_number: "Invoice number matches a previously processed document",
  amount_anomaly: "Amount deviates significantly from this vendor's historical range",
};

export default function FraudSignals({ companyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const params = companyId ? `?company_id=${companyId}` : "";
    api.get(`/invoices/fraud-signals${params}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading || !data) return null;
  if (data.summary.total === 0) return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3">
      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <p className="text-emerald-700 text-sm font-medium">Financial Lie Detector™ — no suspicious signals found</p>
    </div>
  );

  const visibleSignals = expanded ? data.signals : data.signals.slice(0, 4);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-rose-50 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Financial Lie Detector™</h3>
            <p className="text-xs text-slate-400">{data.summary.affected_invoices} invoice{data.summary.affected_invoices !== 1 ? "s" : ""} with behavioral anomalies</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.summary.high > 0 && <span className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full font-semibold">{data.summary.high} high</span>}
          {data.summary.medium > 0 && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-semibold">{data.summary.medium} medium</span>}
          {data.summary.low > 0 && <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-semibold">{data.summary.low} low</span>}
        </div>
      </div>

      {(() => {
        const why = buildWhyFlagged(data.signals);
        return why ? (
          <div className="flex items-start gap-2 px-5 py-3 bg-rose-50/60 border-b border-rose-100">
            <svg className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-rose-700 leading-relaxed">{why}</p>
          </div>
        ) : null;
      })()}

      <div className="divide-y divide-slate-50">
        {visibleSignals.map((s, i) => {
          const cfg = SEVERITY_CONFIG[s.severity];
          return (
            <div key={i} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{SIGNAL_LABELS[s.signal] || s.signal}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{s.file_name} · {s.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {data.signals.length > 4 && (
        <button onClick={() => setExpanded(e => !e)} className="w-full py-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium border-t border-slate-50 transition-colors">
          {expanded ? "Show less" : `Show ${data.signals.length - 4} more signals`}
        </button>
      )}
    </div>
  );
}
