import { useEffect, useState } from "react";

const STAGES = [
  { key: "queued",        label: "Document Received",           sub: "Queued for autonomous processing",     est: "< 1s" },
  { key: "preprocessing", label: "Preprocessing",                sub: "Deskewing · Denoising · Sharpening",   est: "~2s" },
  { key: "extracting",    label: "Multi-Engine AI Extraction",   sub: "Groq Vision · PyMuPDF · OCR running",  est: "~8s" },
  { key: "validating",    label: "Consensus Validation",         sub: "GST format · Math check · Duplicates", est: "~2s" },
  { key: "scoring",       label: "Trust Scoring",                sub: "Field confidence · Conflict detection", est: "~1s" },
  { key: "complete",      label: "Extraction Complete",          sub: "All systems agree — ready for review", est: null },
];

const ORDER = STAGES.map(s => s.key);

export default function LiveProcessing({ processingStatus }) {
  const [elapsed, setElapsed] = useState(0);
  const currentIdx = ORDER.indexOf(processingStatus);
  const failed = processingStatus === "failed";
  const complete = processingStatus === "complete";
  const progress = failed ? 30 : complete ? 100 : Math.round(((currentIdx + 1) / STAGES.length) * 100);

  useEffect(() => {
    if (complete || failed) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [complete, failed]);

  const currentStage = STAGES[currentIdx];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Top gradient accent */}
      <div className={`h-1 transition-all duration-700 ${failed ? "bg-rose-400" : complete ? "bg-emerald-500" : "bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600"}`}
        style={{ width: "100%" }}
      />

      <div className="p-6">
        {/* Progress header */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {!complete && !failed && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
                </span>
              )}
              {complete ? "✓ Processing complete" : failed ? "Processing failed" : `${currentStage?.label || "Processing"}…`}
            </span>
            <div className="flex items-center gap-3">
              {!complete && !failed && (
                <span className="text-xs text-slate-400 font-mono">{elapsed}s</span>
              )}
              <span className={`text-xs font-semibold ${complete ? "text-emerald-600" : failed ? "text-rose-500" : "text-indigo-600"}`}>
                {progress}%
              </span>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${failed ? "bg-rose-400" : complete ? "bg-emerald-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {!complete && !failed && currentStage?.sub && (
            <p className="text-xs text-indigo-500 mt-1.5 font-medium">{currentStage.sub}</p>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-0">
          {STAGES.map((stage, idx) => {
            const isDone = currentIdx > idx && !failed;
            const isCurrent = ORDER[currentIdx] === stage.key && !failed;
            const isPending = currentIdx < idx || failed;
            const isLast = idx === STAGES.length - 1;

            return (
              <div key={stage.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-400
                    ${isDone ? "bg-emerald-500 shadow-sm shadow-emerald-200" : ""}
                    ${isCurrent ? "bg-indigo-600 ring-4 ring-indigo-100 shadow-sm shadow-indigo-200" : ""}
                    ${isPending ? "bg-slate-100" : ""}
                  `}>
                    {isDone && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isCurrent && (
                      <div className="w-2.5 h-2.5 bg-white dark:bg-slate-800 rounded-full animate-pulse" />
                    )}
                    {isPending && (
                      <div className="w-2 h-2 bg-slate-300 rounded-full" />
                    )}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 h-8 mt-0.5 transition-all duration-500 ${isDone ? "bg-emerald-200" : "bg-slate-100"}`} />
                  )}
                </div>

                <div className={`pb-6 flex-1 flex items-start justify-between ${isLast ? "pb-0" : ""}`}>
                  <div className={`inline-flex flex-col ${isCurrent ? "bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 -ml-1" : "pt-1"}`}>
                    <span className={`text-sm font-semibold leading-none
                      ${isDone ? "text-slate-500" : ""}
                      ${isCurrent ? "text-indigo-700" : ""}
                      ${isPending ? "text-slate-300" : ""}
                    `}>
                      {stage.label}
                    </span>
                    <span className={`text-xs mt-1
                      ${isDone ? "text-slate-400" : ""}
                      ${isCurrent ? "text-indigo-400" : ""}
                      ${isPending ? "text-slate-200" : ""}
                    `}>
                      {stage.sub}
                    </span>
                  </div>
                  {stage.est && (
                    <span className={`text-[10px] font-mono flex-shrink-0 mt-1.5
                      ${isDone ? "text-emerald-400" : isCurrent ? "text-indigo-300" : "text-slate-200"}`}>
                      {isDone ? "✓" : stage.est}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {failed && (
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-rose-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="pt-1">
                <span className="text-sm font-semibold text-rose-600">Processing failed</span>
                <p className="text-xs text-rose-400 mt-0.5">Please try again with a clearer document</p>
              </div>
            </div>
          )}
        </div>

        {/* AI attribution footer */}
        {!complete && !failed && (
          <div className="mt-5 pt-4 border-t border-slate-50 flex items-center gap-2">
            <div className="flex -space-x-1">
              {["G", "P", "O"].map((l, i) => (
                <div key={l} className={`w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center border border-white
                  ${i === 0 ? "bg-violet-500" : i === 1 ? "bg-indigo-500" : "bg-blue-500"}`}>{l}</div>
              ))}
            </div>
            <p className="text-xs text-slate-400">Groq Vision · PyMuPDF · OCR running in parallel</p>
          </div>
        )}
      </div>
    </div>
  );
}
