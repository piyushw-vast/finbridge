const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;

function buildReasons(invoice, tx) {
  const scores = invoice.confidence_scores || {};
  const conflicts = invoice.conflicts || [];
  const score = invoice.trust_score ?? 0;
  const reasons = [];
  const concerns = [];

  if (tx?.vendor_name) {
    reasons.push({ text: "Vendor identity extracted and recognized", key: "vendor" });
  } else {
    concerns.push({ text: "Vendor name could not be reliably extracted from document", key: "no_vendor" });
  }

  if (tx?.vendor_gst) {
    const valid = GST_RE.test(tx.vendor_gst.toUpperCase().trim());
    if (valid) reasons.push({ text: "GST number verified — 15-char PAN-based format matched", key: "gst" });
    else concerns.push({ text: "GST number format does not match standard PAN-based pattern", key: "bad_gst" });
  } else {
    concerns.push({ text: "No GST number present — tax compliance check incomplete", key: "no_gst" });
  }

  const allScores = Object.values(scores);
  if (allScores.length > 0) {
    const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const highConf = allScores.filter((s) => s >= 0.85).length;
    if (avg >= 0.75) {
      reasons.push({
        text: `${highConf}/${allScores.length} fields reached high-confidence consensus across all extraction engines`,
        key: "consensus",
      });
    } else {
      concerns.push({ text: "Below-threshold average confidence across extraction engines", key: "low_conf" });
    }
  }

  if (!invoice.is_duplicate) {
    reasons.push({ text: "No duplicate signature found in Financial Memory Engine", key: "no_dup" });
  } else {
    concerns.push({ text: "Potential duplicate — behavioral signature matches a prior invoice", key: "dup" });
  }

  if (conflicts.length === 0) {
    reasons.push({ text: "Zero extraction conflicts — all engines agree on every field value", key: "no_conflicts" });
  } else {
    concerns.push({
      text: `${conflicts.length} field${conflicts.length > 1 ? "s" : ""} with extraction conflicts: ${conflicts
        .map((c) => c.field?.replace(/_/g, " "))
        .join(", ")}`,
      key: "conflicts",
    });
  }

  const amtConf = scores["total_amount"];
  if (amtConf !== undefined) {
    if (amtConf >= 0.85) {
      reasons.push({ text: "Total amount extracted with high confidence across all engines", key: "amt_conf" });
    } else if (amtConf < 0.6) {
      concerns.push({ text: "Total amount confidence below threshold — manual verification recommended", key: "amt_low" });
    }
  }

  const trustLabel =
    score >= 85
      ? "eligible for autonomous approval"
      : score >= 60
      ? "routed for human review"
      : "requires mandatory manual verification";

  return { reasons, concerns, trustLabel, score };
}

export default function TrustExplainability({ invoice, tx }) {
  const { reasons, concerns, trustLabel, score } = buildReasons(invoice, tx);
  const isPositive = score >= 85;
  const isMid = score >= 60 && score < 85;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isPositive
              ? "bg-emerald-50 dark:bg-emerald-900/30"
              : isMid
              ? "bg-amber-50 dark:bg-amber-900/30"
              : "bg-rose-50 dark:bg-rose-900/30"
          }`}
        >
          <svg
            className={`w-3.5 h-3.5 ${
              isPositive ? "text-emerald-500" : isMid ? "text-amber-500" : "text-rose-500"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Trust Explainability</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Why the Trust Layer scored this invoice {score}/100</p>
        </div>
      </div>

      <div
        className={`text-xs font-medium px-3 py-2 rounded-lg mb-4 ${
          isPositive
            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800"
            : isMid
            ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800"
            : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800"
        }`}
      >
        Score {score}/100 — invoice {trustLabel}
      </div>

      {reasons.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Trust factors</p>
          <div className="space-y-1.5">
            {reasons.map((r) => (
              <div key={r.key} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {concerns.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Risk factors</p>
          <div className="space-y-1.5">
            {concerns.map((c) => (
              <div key={c.key} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-amber-600 dark:text-amber-400 text-[9px] font-bold">!</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-700 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-[10px] text-slate-400 dark:text-slate-600">
          Scoring by Financial Intelligence Engine · Groq Vision · Consensus Validation Engine
        </p>
      </div>
    </div>
  );
}
