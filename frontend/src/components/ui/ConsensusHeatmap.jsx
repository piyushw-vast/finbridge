import { useMemo } from "react";

const FIELDS = [
  { key: "vendor_name", label: "Vendor Name" },
  { key: "vendor_gst", label: "GST Number" },
  { key: "invoice_number", label: "Invoice No." },
  { key: "invoice_date", label: "Invoice Date" },
  { key: "total_amount", label: "Total Amount" },
  { key: "subtotal", label: "Subtotal" },
  { key: "tax_amount", label: "Tax Amount" },
];

const ENGINES = ["Groq Vision", "PyMuPDF", "OCR"];

function getEngineAgreement(confidence, isConflict) {
  // Returns array of 3 statuses: "agree" | "partial" | "disagree"
  if (isConflict || confidence < 0.5) return ["partial", "disagree", "disagree"];
  if (confidence < 0.7) return ["agree", "partial", "disagree"];
  if (confidence < 0.85) return ["agree", "agree", "partial"];
  return ["agree", "agree", "agree"];
}

const STATUS_STYLE = {
  agree:    { bg: "bg-emerald-100", border: "border-emerald-200", dot: "bg-emerald-500", label: "✓" },
  partial:  { bg: "bg-amber-50",    border: "border-amber-200",   dot: "bg-amber-400",   label: "~" },
  disagree: { bg: "bg-rose-50",     border: "border-rose-200",    dot: "bg-rose-400",    label: "✗" },
};

export default function ConsensusHeatmap({ invoice, tx }) {
  const conflictFields = new Set((invoice.conflicts || []).map(c => c.field));
  const scores = invoice.confidence_scores || {};

  const rows = FIELDS.filter(f => tx?.[f.key] !== null && tx?.[f.key] !== undefined);

  const overallAgreement = rows.filter(f => {
    const conf = scores[f.key];
    return conf !== undefined && conf >= 0.85 && !conflictFields.has(f.key);
  }).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Consensus Heatmap</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Per-engine agreement inferred from consensus confidence scores</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-slate-900 dark:text-white">{rows.length > 0 ? Math.round((overallAgreement / rows.length) * 100) : 0}%</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">consensus</p>
        </div>
      </div>

      {/* Engine header */}
      <div className="grid mb-2" style={{ gridTemplateColumns: "120px repeat(3, 1fr)" }}>
        <div />
        {ENGINES.map(e => (
          <div key={e} className="text-center">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{e}</span>
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {rows.map(field => {
          const conf = scores[field.key];
          const isConflict = conflictFields.has(field.key);
          const statuses = conf !== undefined
            ? getEngineAgreement(conf, isConflict)
            : ["partial", "partial", "partial"];

          return (
            <div key={field.key} className="grid items-center gap-1.5" style={{ gridTemplateColumns: "120px repeat(3, 1fr)" }}>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">{field.label}</span>
                {isConflict && <span className="text-amber-500 text-xs flex-shrink-0">⚠</span>}
              </div>
              {statuses.map((status, i) => {
                const s = STATUS_STYLE[status];
                return (
                  <div key={i} className={`h-7 rounded-lg border flex items-center justify-center text-xs font-bold ${s.bg} ${s.border}`}>
                    <span className={status === "agree" ? "text-emerald-600" : status === "partial" ? "text-amber-500" : "text-rose-500"}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-50 dark:border-slate-700">
        {[
          { status: "agree", label: "Full consensus" },
          { status: "partial", label: "Partial agreement" },
          { status: "disagree", label: "Conflict detected" },
        ].map(l => (
          <div key={l.status} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${STATUS_STYLE[l.status].bg} border ${STATUS_STYLE[l.status].border}`} />
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
