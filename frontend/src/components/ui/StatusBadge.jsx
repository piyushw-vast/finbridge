const STATUS_CONFIG = {
  pending: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", label: "Pending" },
  under_review: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500", label: "Under Review" },
  accepted: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Accepted" },
  needs_correction: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Needs Correction" },
  rejected: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", label: "Rejected" },
};

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
