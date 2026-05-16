import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

const STEPS = [
  { label: "Financial Intelligence Engine", sub: "Groq Vision · PyMuPDF · OCR consensus ready" },
  { label: "Multi-Engine Validator", sub: "Cross-verification pipeline initialized" },
  { label: "Trust Scoring Layer", sub: "Confidence calibration complete" },
  { label: "GST Compliance Monitor", sub: "Regulatory rules loaded" },
  { label: "Autonomous Review Pipeline", sub: "Ready to process documents" },
];

export default function OnboardingSplash({ onDone }) {
  const { user } = useAuth();
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [done, setDone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let step = 0;
    const tick = () => {
      step++;
      setVisibleSteps(step);
      if (step < STEPS.length) {
        setTimeout(tick, 480);
      } else {
        setTimeout(() => setDone(true), 600);
      }
    };
    const t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, [user]);

  function handleEnter() {
    localStorage.setItem(`fb-onboarded-${user?.id}`, "1");
    setLeaving(true);
    setTimeout(onDone, 500);
  }

  return (
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center transition-opacity duration-500
        ${leaving ? "opacity-0" : "opacity-100"}
        bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950`}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md w-full mx-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-900/50">
            <span className="text-white font-black text-sm tracking-tight">FB</span>
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">FinBridge</p>
            <p className="text-indigo-400 text-xs mt-0.5">Autonomous Financial Intelligence</p>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-bold text-white leading-tight mb-2">
          Welcome, {user?.full_name?.split(" ")[0]}.
        </h1>
        <p className="text-indigo-300 text-sm mb-10 leading-relaxed">
          Your autonomous finance pipeline is initializing…
        </p>

        {/* Checklist */}
        <div className="space-y-4 mb-10">
          {STEPS.map((step, i) => {
            const isVisible = i < visibleSteps;
            const isCurrent = i === visibleSteps - 1 && !done;
            return (
              <div
                key={i}
                className={`flex items-center gap-4 transition-all duration-500 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300
                  ${isCurrent ? "bg-indigo-600 ring-4 ring-indigo-600/30" : isVisible ? "bg-emerald-500" : "bg-slate-800"}`}
                >
                  {isCurrent ? (
                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                  ) : isVisible ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div className="w-2 h-2 bg-slate-600 rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold transition-colors ${isVisible ? "text-white" : "text-slate-600"}`}>
                    {step.label}
                  </p>
                  <p className={`text-xs transition-colors ${isCurrent ? "text-indigo-400" : isVisible ? "text-slate-400" : "text-slate-700"}`}>
                    {step.sub}
                  </p>
                </div>
                {isVisible && !isCurrent && (
                  <span className="text-[10px] text-emerald-400 font-semibold flex-shrink-0">ONLINE</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Enter button */}
        <div className={`transition-all duration-700 ${done ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-4">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Platform ready — all systems operational
          </div>
          <button
            onClick={handleEnter}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40"
          >
            Enter FinBridge
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
