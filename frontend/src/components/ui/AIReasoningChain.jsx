import { useState, useEffect } from "react";

const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;

function buildSteps(invoice, tx) {
  const steps = [];
  const conflicts = invoice.conflicts || [];
  const scores = invoice.confidence_scores || {};

  const typeLabel =
    invoice.invoice_type === "bank_statement" ? "Bank Statement"
    : invoice.invoice_type === "purchase" ? "Purchase Invoice"
    : invoice.invoice_type === "expense" ? "Expense Receipt"
    : (invoice.invoice_type || "Invoice").replace(/_/g, " ");
  steps.push({ ok: true, stage: "Intake Agent", text: `Document classified as ${typeLabel}` });

  if (tx?.vendor_name) {
    steps.push({ ok: true, stage: "Financial Memory Engine", text: `Vendor "${tx.vendor_name}" identified and cross-referenced` });
  } else {
    steps.push({ ok: false, warn: true, stage: "Financial Memory Engine", text: "Vendor identity could not be established from document" });
  }

  if (tx?.vendor_gst) {
    const valid = GST_RE.test(tx.vendor_gst.toUpperCase().trim());
    steps.push({
      ok: valid,
      warn: !valid,
      stage: "Validation Agent",
      text: valid
        ? `GST ${tx.vendor_gst} — 15-char PAN-based format verified`
        : `GST "${tx.vendor_gst}" — format anomaly detected, manual verification required`,
    });
  } else {
    steps.push({ ok: false, warn: true, stage: "Validation Agent", text: "No GST number present — tax compliance check incomplete" });
  }

  if (tx?.total_amount) {
    const amountConf = scores["total_amount"];
    const confLabel =
      amountConf >= 0.85 ? "high confidence" : amountConf >= 0.6 ? "moderate confidence" : "low confidence";
    steps.push({
      ok: amountConf === undefined || amountConf >= 0.6,
      warn: amountConf !== undefined && amountConf < 0.6,
      stage: "Financial Intelligence Engine",
      text: `Amount ₹${tx.total_amount.toLocaleString("en-IN")} extracted — ${confLabel}`,
    });
  }

  if (invoice.is_duplicate) {
    steps.push({ ok: false, warn: true, stage: "Duplicate Detection", text: "Behavioral match detected — invoice signature matches historical record" });
  } else {
    steps.push({ ok: true, stage: "Duplicate Detection", text: "No duplicate signature found in Financial Memory Engine" });
  }

  const allScores = Object.values(scores);
  if (allScores.length > 0) {
    const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const agreeing = allScores.filter((s) => s >= 0.85).length;
    steps.push({
      ok: avg >= 0.7,
      warn: avg < 0.7,
      stage: "Consensus Validation Engine",
      text: `${agreeing}/${allScores.length} fields reached cross-engine consensus — avg confidence ${(avg * 100).toFixed(0)}%`,
    });
  }

  conflicts.forEach((c) => {
    steps.push({
      ok: false,
      warn: true,
      stage: "Conflict Resolver",
      text: `${c.field?.replace(/_/g, " ")} — ${c.description}`,
    });
  });

  const score = invoice.trust_score;
  if (score >= 85) {
    steps.push({ ok: true, final: true, stage: "Trust Layer", text: `Trust score ${score}/100 — autonomous approval authorized` });
  } else if (score >= 60) {
    steps.push({ ok: false, warn: true, final: true, stage: "Trust Layer", text: `Trust score ${score}/100 — routed to human review pipeline` });
  } else {
    steps.push({ ok: false, final: true, stage: "Trust Layer", text: `Trust score ${score}/100 — mandatory manual verification required` });
  }

  return steps;
}

export default function AIReasoningChain({ invoice, tx }) {
  const steps = buildSteps(invoice, tx);
  const [replayKey, setReplayKey] = useState(0);
  const [visible, setVisible] = useState(steps.length);
  const [replaying, setReplaying] = useState(false);

  function replay() {
    if (replaying) return;
    setReplaying(true);
    setVisible(0);
    setReplayKey((k) => k + 1);
  }

  useEffect(() => {
    if (!replaying) return;
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setVisible(i);
      if (i >= steps.length) {
        clearInterval(timer);
        setReplaying(false);
      }
    }, 300);
    return () => clearInterval(timer);
  }, [replayKey]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Autonomous Verification Pipeline</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Replayable AI reasoning audit trail</p>
          </div>
        </div>
        <button
          onClick={replay}
          disabled={replaying}
          className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 border border-indigo-100 dark:border-indigo-800 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
        >
          <svg className={`w-3 h-3 ${replaying ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {replaying ? "Replaying…" : "Replay Analysis"}
        </button>
      </div>

      <div className="space-y-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const show = i < visible;
          return (
            <div
              key={`${replayKey}-${i}`}
              className={`flex gap-3 transition-all duration-300 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    step.ok
                      ? "bg-emerald-100 dark:bg-emerald-900/40"
                      : step.warn
                      ? "bg-amber-100 dark:bg-amber-900/40"
                      : "bg-rose-100 dark:bg-rose-900/40"
                  }`}
                >
                  {step.ok ? (
                    <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : step.warn ? (
                    <span className="text-amber-600 dark:text-amber-400 text-[10px] font-bold">!</span>
                  ) : (
                    <svg className="w-3 h-3 text-rose-500 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                {!isLast && <div className={`w-px flex-1 my-0.5 ${step.ok ? "bg-emerald-100 dark:bg-emerald-900" : "bg-slate-100 dark:bg-slate-700"}`} />}
              </div>
              <div className="pb-3 flex-1 min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                  step.ok ? "text-slate-400 dark:text-slate-500" : step.warn ? "text-amber-500 dark:text-amber-400" : "text-rose-400 dark:text-rose-400"
                }`}>
                  {step.stage}
                </p>
                <p
                  className={`text-xs leading-relaxed ${step.final ? "font-semibold " : ""}${
                    step.ok
                      ? "text-slate-700 dark:text-slate-300"
                      : step.warn
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {step.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
