import { useState, useEffect } from "react";
import api from "../../lib/api";

const ACTION_CONFIG = {
  invoice_uploaded: { label: "Uploaded", color: "bg-indigo-500", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
  invoice_extracted: { label: "AI Extracted", color: "bg-violet-500", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2" },
  invoice_accepted: { label: "Accepted", color: "bg-emerald-500", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  invoice_rejected: { label: "Rejected", color: "bg-rose-500", icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" },
  invoice_correction_submitted: { label: "Corrected", color: "bg-amber-500", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AuditTrail({ invoiceId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/invoices/${invoiceId}/audit`)
      .then(r => setLogs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading) return <div className="shimmer h-24 rounded-2xl" />;
  if (!logs.length) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-5">Audit Trail</h2>
      <div className="space-y-0">
        {logs.map((log, idx) => {
          const cfg = ACTION_CONFIG[log.action] || { label: log.action, color: "bg-slate-400", icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" };
          const isLast = idx === logs.length - 1; // last in array = oldest
          return (
            <div key={log.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full ${cfg.color} flex items-center justify-center flex-shrink-0`}>
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
                  </svg>
                </div>
                {!isLast && <div className="w-0.5 h-8 bg-slate-100 mt-0.5" />}
              </div>
              <div className={`flex-1 ${isLast ? "pb-0" : "pb-2"} pt-1`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{cfg.label}</span>
                  <span className="text-xs text-slate-400">{timeAgo(log.created_at)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  by <span className="font-medium text-slate-600">{log.user_name}</span>
                  {log.user_role && <span className="ml-1 capitalize">({log.user_role.replace("_", " ")})</span>}
                </p>
                {log.details?.notes && (
                  <p className="text-xs text-slate-500 mt-1 italic">"{log.details.notes}"</p>
                )}
                {log.details?.reason && (
                  <p className="text-xs text-rose-500 mt-1 italic">"{log.details.reason}"</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
