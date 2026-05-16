import { useState, useEffect } from "react";

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Don't show if already running as PWA or dismissed before
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem("pwa-dismissed")) return;

    function handler(e) {
      e.preventDefault();
      setPrompt(e);
      setShow(true);
    }
    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setShow(false);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setShow(false);
  }

  function handleDismiss() {
    localStorage.setItem("pwa-dismissed", "1");
    setShow(false);
  }

  if (!show || installed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[300] p-4 animate-in slide-in-from-bottom">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 max-w-sm mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-sm">Install FinBridge</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Add to your home screen — upload invoices on the go, even offline.
            </p>
          </div>
          <button onClick={handleDismiss} className="text-slate-300 hover:text-slate-500 flex-shrink-0 p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleInstall}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            Add to Home Screen
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
