import { useMemo } from "react";

function computeAxes(invoice, tx) {
  // 1. Extraction Confidence (0-100)
  const scores = Object.values(invoice.confidence_scores || {});
  const avgConf = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5;
  const extractionConf = Math.round(avgConf * 100);

  // 2. Duplicate Risk — INVERTED (higher = safer)
  const dupRisk = invoice.is_duplicate ? 10 : 95;

  // 3. Vendor Trust
  const vendorTrust = tx?.vendor_gst ? 85 : tx?.vendor_name ? 60 : 30;

  // 4. GST Validity
  const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
  let gstValid = 50;
  if (tx?.vendor_gst) {
    gstValid = GST_RE.test(tx.vendor_gst.toUpperCase().trim()) ? 95 : 15;
  }

  // 5. Amount Anomaly — INVERTED (100 = no anomaly)
  const amountScore = invoice.trust_score ? Math.min(100, invoice.trust_score + 10) : 50;

  // 6. Conflict Count — INVERTED (100 = no conflicts)
  const conflicts = invoice.conflicts || [];
  const conflictScore = Math.max(0, 100 - conflicts.length * 25);

  return [
    { label: "Extraction\nConfidence", value: extractionConf, color: "#6366f1" },
    { label: "Duplicate\nRisk", value: dupRisk, color: "#10b981" },
    { label: "Vendor\nTrust", value: vendorTrust, color: "#f59e0b" },
    { label: "GST\nValidity", value: gstValid, color: "#3b82f6" },
    { label: "Amount\nScore", value: amountScore, color: "#8b5cf6" },
    { label: "No\nConflicts", value: conflictScore, color: "#06b6d4" },
  ];
}

function RadarChart({ axes }) {
  const SIZE = 200;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 80;
  const N = axes.length;
  const levels = 4;

  function polar(angle, r) {
    const a = (angle * Math.PI * 2) / N - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  const gridLines = Array.from({ length: levels }, (_, i) => {
    const r = (R * (i + 1)) / levels;
    const points = Array.from({ length: N }, (_, j) => polar(j, r).join(",")).join(" ");
    return <polygon key={i} points={points} fill="none" stroke="#e2e8f0" strokeWidth="1" />;
  });

  const axisLines = axes.map((_, i) => {
    const [x, y] = polar(i, R);
    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
  });

  const dataPoints = axes.map((ax, i) => polar(i, (ax.value / 100) * R));
  const dataPath = dataPoints.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ") + "Z";

  const avg = axes.reduce((s, a) => s + a.value, 0) / axes.length;
  const fillColor = avg >= 75 ? "#10b981" : avg >= 50 ? "#f59e0b" : "#f43f5e";

  const labels = axes.map((ax, i) => {
    const [x, y] = polar(i, R + 22);
    const lines = ax.label.split("\n");
    return (
      <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#64748b" fontWeight="500">
        {lines.map((line, li) => (
          <tspan key={li} x={x} dy={li === 0 ? (lines.length > 1 ? "-0.5em" : "0") : "1.2em"}>{line}</tspan>
        ))}
      </text>
    );
  });

  const dots = dataPoints.map(([x, y], i) => (
    <circle key={i} cx={x} cy={y} r="3" fill={fillColor} stroke="white" strokeWidth="1.5" />
  ));

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {gridLines}
      {axisLines}
      <path d={dataPath} fill={fillColor} fillOpacity={0.15} stroke={fillColor} strokeWidth="2" strokeLinejoin="round" />
      {dots}
      {labels}
    </svg>
  );
}

export default function RiskRadar({ invoice, tx }) {
  const axes = useMemo(() => computeAxes(invoice, tx), [invoice, tx]);
  const avg = Math.round(axes.reduce((s, a) => s + a.value, 0) / axes.length);
  const label = avg >= 75
    ? { text: "Low Risk", color: "text-emerald-600", bg: "bg-emerald-50" }
    : avg >= 50
    ? { text: "Medium Risk", color: "text-amber-600", bg: "bg-amber-50" }
    : { text: "High Risk", color: "text-rose-600", bg: "bg-rose-50" };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Risk Radar</h2>
          <p className="text-xs text-slate-400 mt-0.5">Multi-dimensional risk profile</p>
        </div>
        <div className={`px-3 py-1.5 rounded-xl ${label.bg}`}>
          <span className={`text-sm font-bold ${label.color}`}>{label.text}</span>
        </div>
      </div>

      <div className="flex justify-center mb-4">
        <RadarChart axes={axes} />
      </div>

      <div className="space-y-2.5">
        {axes.map(ax => (
          <div key={ax.label} className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 w-36 flex-shrink-0">{ax.label.replace("\n", " ")}</span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${ax.value}%`, backgroundColor: ax.color }}
              />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 w-7 text-right flex-shrink-0">{ax.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
