import { useMemo } from "react";

const AGENTS = [
  {
    id: "intake",
    name: "Intake Agent",
    role: "Document Receiver",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    stage: "queued",
    color: "indigo",
  },
  {
    id: "preprocess",
    name: "Vision Agent",
    role: "Image Enhancement",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    stage: "preprocessing",
    color: "violet",
  },
  {
    id: "extract",
    name: "Extraction Agent",
    role: "Groq · PyMuPDF · OCR",
    icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2",
    stage: "extracting",
    color: "blue",
  },
  {
    id: "validate",
    name: "Validation Agent",
    role: "GST · Math · Duplicates",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    stage: "validating",
    color: "emerald",
  },
  {
    id: "risk",
    name: "Risk Agent",
    role: "Trust Scoring",
    icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z",
    stage: "scoring",
    color: "amber",
  },
  {
    id: "consensus",
    name: "Consensus Agent",
    role: "Final Decision",
    icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
    stage: "complete",
    color: "rose",
  },
];

const STAGE_ORDER = ["queued", "preprocessing", "extracting", "validating", "scoring", "complete"];

const COLOR_MAP = {
  indigo:  { ring: "ring-indigo-200",  bg: "bg-indigo-50",  icon: "text-indigo-500",  active: "bg-indigo-600",  activeTxt: "text-indigo-700",  dot: "bg-indigo-500" },
  violet:  { ring: "ring-violet-200",  bg: "bg-violet-50",  icon: "text-violet-500",  active: "bg-violet-600",  activeTxt: "text-violet-700",  dot: "bg-violet-500" },
  blue:    { ring: "ring-blue-200",    bg: "bg-blue-50",    icon: "text-blue-500",    active: "bg-blue-600",    activeTxt: "text-blue-700",    dot: "bg-blue-500" },
  emerald: { ring: "ring-emerald-200", bg: "bg-emerald-50", icon: "text-emerald-500", active: "bg-emerald-600", activeTxt: "text-emerald-700", dot: "bg-emerald-500" },
  amber:   { ring: "ring-amber-200",   bg: "bg-amber-50",   icon: "text-amber-500",   active: "bg-amber-600",   activeTxt: "text-amber-700",   dot: "bg-amber-500" },
  rose:    { ring: "ring-rose-200",    bg: "bg-rose-50",    icon: "text-rose-500",    active: "bg-rose-600",    activeTxt: "text-rose-700",    dot: "bg-rose-500" },
};

export default function AgentPipeline({ processingStatus }) {
  const currentIdx = STAGE_ORDER.indexOf(processingStatus);
  const failed = processingStatus === "failed";
  const progress = failed ? 25 : currentIdx === -1 ? 0 : Math.round(((currentIdx + 1) / STAGE_ORDER.length) * 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse inline-block" />
            AI Pipeline Running
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">6 specialized agents collaborating</p>
        </div>
        <span className="text-sm font-bold text-slate-700">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-6">
        <div
          className={`h-full rounded-full transition-all duration-700 ${failed ? "bg-rose-400" : "bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-500"}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Agent grid — 3x2 */}
      <div className="grid grid-cols-3 gap-3">
        {AGENTS.map((agent, idx) => {
          const agentStageIdx = STAGE_ORDER.indexOf(agent.stage);
          const isDone = currentIdx > agentStageIdx && !failed;
          const isCurrent = currentIdx === agentStageIdx && !failed;
          const isPending = currentIdx < agentStageIdx || failed;
          const c = COLOR_MAP[agent.color];

          return (
            <div
              key={agent.id}
              className={`rounded-xl border p-3 transition-all duration-300 ${
                isDone ? `${c.bg} border-transparent` :
                isCurrent ? `${c.bg} border-transparent ring-2 ${c.ring} shadow-sm` :
                "bg-slate-50 border-slate-100"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isCurrent || isDone ? c.active : "bg-slate-200"}`}>
                  {isDone ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  ) : (
                    <svg className={`w-3.5 h-3.5 ${isPending ? "text-slate-400" : "text-white"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={agent.icon} />
                    </svg>
                  )}
                </div>
                {isCurrent && <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-ping flex-shrink-0`} />}
              </div>
              <p className={`text-xs font-semibold leading-tight ${isCurrent ? c.activeTxt : isDone ? "text-slate-700" : "text-slate-300"}`}>
                {agent.name}
              </p>
              <p className={`text-[10px] mt-0.5 leading-tight ${isCurrent ? c.activeTxt + " opacity-70" : isDone ? "text-slate-400" : "text-slate-200"}`}>
                {agent.role}
              </p>
            </div>
          );
        })}
      </div>

      {failed && (
        <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <p className="text-sm text-rose-700 font-medium">Pipeline failed — please re-upload</p>
        </div>
      )}
    </div>
  );
}
