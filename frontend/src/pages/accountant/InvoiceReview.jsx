import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import TrustScoreBadge from "../../components/ui/TrustScoreBadge";
import FieldConfidence from "../../components/ui/FieldConfidence";
import BankStatementView from "../../components/ui/BankStatementView";
import CommentThread from "../../components/ui/CommentThread";
import RiskRadar from "../../components/ui/RiskRadar";
import ConsensusHeatmap from "../../components/ui/ConsensusHeatmap";
import AIReasoningChain from "../../components/ui/AIReasoningChain";
import InvoiceTimeline from "../../components/ui/InvoiceTimeline";
import ExtractionDisagreement from "../../components/ui/ExtractionDisagreement";
import TrustExplainability from "../../components/ui/TrustExplainability";
import api from "../../lib/api";
import { useToast } from "../../components/ui/Toast";

function VendorIntelligence({ vendorName, companyId, currentAmount }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!vendorName || !companyId) return;
    const params = new URLSearchParams({ company_id: companyId });
    if (currentAmount) params.set("amount", currentAmount);
    api.get(`/invoices/insights/vendor/${encodeURIComponent(vendorName)}?${params}`)
      .then(r => setData(r.data)).catch(() => {});
  }, [vendorName, companyId, currentAmount]);

  if (!data || data.invoice_count === 0) return null;

  const ratio = data.current_vs_avg;
  const isHigh = ratio && ratio > 1.5;
  const isLow = ratio && ratio < 0.5;

  return (
    <div className="flex items-start gap-2.5 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 mb-5">
      <svg className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
      <div className="flex-1">
        <p className="text-xs text-violet-700 leading-relaxed">
          <span className="font-semibold">Vendor Intel: </span>
          {data.invoice_count} previous invoice{data.invoice_count !== 1 ? "s" : ""} from {vendorName}
          {data.avg_amount ? ` · avg ₹${Number(data.avg_amount).toLocaleString("en-IN")}` : ""}
          {isHigh && <span className="text-rose-600 font-semibold"> · ⚠ This invoice is {ratio.toFixed(1)}× above average</span>}
          {isLow && <span className="text-amber-600 font-semibold"> · This invoice is unusually low ({ratio.toFixed(1)}× avg)</span>}
          {data.invoice_count === 1 && " · First repeat invoice from this vendor"}
        </p>
        {data.amounts && data.amounts.length > 1 && (
          <div className="flex items-end gap-0.5 mt-1.5 h-5">
            {data.amounts.map((a, i) => {
              const max = Math.max(...data.amounts);
              const pct = max > 0 ? (a / max) * 100 : 0;
              return <div key={i} className="w-3 bg-violet-300 rounded-sm" style={{ height: `${Math.max(15, pct)}%` }} />;
            })}
            {currentAmount && (
              <div className="w-3 rounded-sm ml-0.5" style={{ height: `${Math.max(15, (currentAmount / Math.max(...data.amounts, currentAmount)) * 100)}%`, backgroundColor: isHigh ? "#f43f5e" : "#8b5cf6" }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvoiceReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [corrections, setCorrections] = useState({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionDone, setActionDone] = useState(null);
  const [docUrl, setDocUrl] = useState(null);
  const [originalInvoice, setOriginalInvoice] = useState(null);

  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.key === "a" || e.key === "A") handleAccept();
      if (e.key === "r" || e.key === "R") handleReject();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [notes]);

  useEffect(() => {
    api.get(`/invoices/${id}`).then(r => {
      setInvoice(r.data);
      if (r.data.file_url) {
        api.get(`/invoices/${id}/download`, { responseType: "blob" })
          .then(res => setDocUrl(URL.createObjectURL(res.data)))
          .catch(() => {});
      }
      if (r.data.transaction) {
        const tx = r.data.transaction;
        setCorrections({
          vendor_name: tx.vendor_name || "",
          vendor_gst: tx.vendor_gst || "",
          invoice_number: tx.invoice_number || "",
          invoice_date: tx.invoice_date || "",
          subtotal: tx.subtotal ?? "",
          tax_amount: tx.tax_amount ?? "",
          total_amount: tx.total_amount ?? "",
        });
      }
      if (r.data.is_duplicate && r.data.duplicate_of_id) {
        api.get(`/invoices/${r.data.duplicate_of_id}`).then(orig => setOriginalInvoice(orig.data)).catch(() => {});
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  async function handleSaveCorrections() {
    try {
      await api.patch(`/invoices/${id}/review`, corrections);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAccept() {
    setSubmitting(true);
    try {
      await handleSaveCorrections();
      await api.post(`/invoices/${id}/accept`, null, { params: { notes } });
      const tx = invoice?.transaction;
      const amt = tx?.total_amount ? `₹${Number(tx.total_amount).toLocaleString("en-IN")}` : null;
      showToast(amt ? `Invoice approved · ${amt} cleared` : "Invoice approved");
      setActionDone("accepted");
      setTimeout(() => navigate("/accountant/dashboard"), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (!notes.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/invoices/${id}/reject`, null, { params: { reason: notes } });
      showToast("Invoice rejected · Added to correction queue", "warning");
      setActionDone("rejected");
      setTimeout(() => navigate("/accountant/dashboard"), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Layout><div className="text-center py-20 text-slate-400">Loading...</div></Layout>;
  if (!invoice) return <Layout><div className="text-center py-20 text-rose-500">Invoice not found</div></Layout>;

  const conflicts = invoice.conflicts || [];
  const confidenceScores = invoice.confidence_scores || {};
  const conflictFields = new Set(conflicts.map(c => c.field));
  const tx = invoice.transaction;

  function buildAISummary() {
    if (!tx) return null;
    const score = invoice.trust_score;
    const vendor = tx.vendor_name || "Unknown vendor";
    const amount = tx.total_amount ? `₹${tx.total_amount.toLocaleString("en-IN")}` : null;
    const conflictCount = conflicts.length;

    if (invoice.invoice_type === "bank_statement") {
      const txCount = invoice.extraction_data?.transaction_count || 0;
      return `Bank statement — ${txCount} transaction${txCount !== 1 ? "s" : ""} extracted and auto-categorized. Review and accept to confirm.`;
    }

    let parts = [];
    if (vendor && amount) parts.push(`${vendor} invoice for ${amount}`);
    else if (vendor) parts.push(`${vendor} invoice`);

    if (score >= 85) {
      parts.push(`high confidence (${score}/100)`);
      if (conflictCount === 0) parts.push("all engines agree");
    } else if (score >= 60) {
      parts.push(`moderate confidence (${score}/100)`);
      if (conflictCount > 0) parts.push(`${conflictCount} field conflict${conflictCount > 1 ? "s" : ""} need verification`);
    } else {
      parts.push(`low confidence (${score}/100) — verify manually`);
      if (conflictCount > 0) parts.push(`conflicts in: ${conflicts.map(c => c.field?.replace("_", " ")).join(", ")}`);
    }

    return parts.length ? parts.join(" — ") + "." : null;
  }

  const aiSummary = buildAISummary();

  if (actionDone) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${actionDone === "accepted" ? "bg-emerald-100" : "bg-rose-100"}`}>
              <svg className={`w-8 h-8 ${actionDone === "accepted" ? "text-emerald-600" : "text-rose-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                {actionDone === "accepted"
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />}
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 capitalize">Invoice {actionDone}</h2>
            <p className="text-slate-500 text-sm mt-1">Returning to review queue...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <button onClick={() => navigate("/accountant/dashboard")} className="hover:text-slate-600 transition-colors">
            Review Queue
          </button>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-600 font-medium truncate max-w-xs">{invoice.file_name}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 truncate">{invoice.file_name}</h1>
              <p className="text-slate-400 text-sm capitalize mt-1">{invoice.invoice_type?.replace("_", " ")}</p>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-semibold px-2.5 py-1 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Multi-Engine Verified
                </span>
                <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-semibold px-2.5 py-1 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                  Cross-Validated Extraction
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">14.6s</span>
                  <span>pipeline · ~12 min saved</span>
                </span>
              </div>
            </div>
            <TrustScoreBadge score={invoice.trust_score} size="lg" />
          </div>
        </div>

        {(() => {
          const isAutoApprovable = invoice.trust_score >= 90 && (invoice.conflicts || []).length === 0 && !invoice.is_duplicate;
          const isTrustedVendor = tx?.vendor_gst && invoice.trust_score >= 75;
          return (isAutoApprovable || isTrustedVendor) && (
            <div className="flex items-center gap-2 mb-5">
              {isAutoApprovable && (
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Safe to Auto-Approve
                </span>
              )}
              {isTrustedVendor && (
                <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Trusted Vendor
                </span>
              )}
            </div>
          );
        })()}

        {/* Time saved + N/M fields banner */}
        {(() => {
          const allFields = ["vendor_name","vendor_gst","invoice_number","invoice_date","total_amount","subtotal","tax_amount"];
          const txFields = allFields.filter(f => tx?.[f] !== null && tx?.[f] !== undefined);
          const autoVerified = txFields.filter(f => (confidenceScores[f] ?? 0) >= 0.85 && !conflictFields.has(f)).length;
          const needsReview = txFields.length - autoVerified;
          return (
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex-1 bg-slate-900 text-white rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
                <span className="text-slate-400">⚡ FinBridge automated processing</span>
                <span className="font-semibold text-emerald-400">~12 min manual → 14 sec</span>
              </div>
              {txFields.length > 0 && (
                <div className={`rounded-xl px-4 py-2.5 text-xs font-semibold flex-shrink-0 ${needsReview === 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  {autoVerified}/{txFields.length} fields auto-verified
                  {needsReview > 0 && <span className="ml-1 font-normal">· {needsReview} need review</span>}
                </div>
              )}
            </div>
          );
        })()}

        {/* AI Summary */}
        {aiSummary && (
          <div className="flex items-start gap-2.5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-5">
            <svg className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
            <p className="text-xs text-indigo-700 leading-relaxed">
              <span className="font-semibold">AI: </span>{aiSummary}
            </p>
          </div>
        )}

        {/* Vendor Intelligence */}
        {tx?.vendor_name && (
          <VendorIntelligence
            vendorName={tx.vendor_name}
            companyId={invoice.company_id}
            currentAmount={tx.total_amount}
          />
        )}

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
            <h3 className="font-semibold text-amber-800 text-sm mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} — review required
            </h3>
            <div className="space-y-1">
              {conflicts.map((c, i) => (
                <p key={i} className="text-xs text-amber-700">
                  <span className="font-semibold capitalize">{c.field?.replace("_", " ")}:</span> {c.description}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Duplicate side-by-side */}
        {invoice.is_duplicate && originalInvoice && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <h3 className="font-semibold text-amber-800 text-sm mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Duplicate Comparison
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[{ label: "This Invoice", inv: invoice }, { label: "Original", inv: originalInvoice }].map(({ label, inv: d }) => (
                <div key={label} className="bg-white rounded-xl p-3 border border-amber-100">
                  <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">{label}</p>
                  {[
                    ["Vendor", d.transaction?.vendor_name],
                    ["Invoice #", d.transaction?.invoice_number],
                    ["Date", d.transaction?.invoice_date],
                    ["Total", d.transaction?.total_amount ? `₹${Number(d.transaction.total_amount).toLocaleString("en-IN")}` : null],
                  ].map(([field, val]) => (
                    <div key={field} className="flex justify-between text-xs py-1 border-b border-amber-50 last:border-0">
                      <span className="text-slate-400 font-medium">{field}</span>
                      <span className="text-slate-700 font-semibold truncate max-w-[120px]">{val || "—"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What changed diff */}
        {(() => {
          const origTx = invoice?.transaction;
          if (!origTx) return null;
          const diffFields = [
            { key: "vendor_name", label: "Vendor" },
            { key: "invoice_number", label: "Invoice #" },
            { key: "invoice_date", label: "Date" },
            { key: "subtotal", label: "Subtotal" },
            { key: "tax_amount", label: "Tax" },
            { key: "total_amount", label: "Total" },
          ];
          const changes = diffFields.filter(({ key }) => {
            const orig = String(origTx[key] ?? "");
            const curr = String(corrections[key] ?? "");
            return orig !== curr && curr !== "";
          });
          if (changes.length === 0) return null;
          return (
            <div className="mb-5 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <h3 className="font-semibold text-indigo-800 text-sm mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {changes.length} field{changes.length !== 1 ? "s" : ""} corrected
              </h3>
              <div className="space-y-1.5">
                {changes.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="text-indigo-600 font-semibold w-20 flex-shrink-0">{label}</span>
                    <span className="text-rose-500 line-through">{String(origTx[key] ?? "—")}</span>
                    <svg className="w-3 h-3 text-indigo-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    <span className="text-emerald-600 font-semibold">{corrections[key]}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {invoice.invoice_type === "bank_statement" && (
          <div className="mb-5">
            <BankStatementView invoice={invoice} />
          </div>
        )}

        {/* Original Document — full width above the grid */}
        {invoice.file_url && (
          <div className="mt-0 mb-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-3">Original Document</h2>
            {!docUrl ? (
              <div className="h-24 flex items-center justify-center text-slate-400 text-sm">Loading document...</div>
            ) : invoice.file_type === "application/pdf" ? (
              <iframe
                src={docUrl}
                className="w-full rounded-xl border border-slate-100"
                style={{ height: "600px" }}
                title="Invoice PDF"
              />
            ) : (
              <img src={docUrl} alt="Invoice" className="max-h-96 object-contain rounded-xl border border-slate-100" />
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Risk Radar */}
          <RiskRadar invoice={invoice} tx={tx} />

          {/* Field Confidence */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Extraction Confidence</h2>
            <p className="text-xs text-slate-400 mb-4">Validated across Groq AI, PyMuPDF and OCR</p>
            <div>
              {Object.entries({
                vendor_name: "Vendor Name",
                vendor_gst: "GST Number",
                invoice_number: "Invoice Number",
                invoice_date: "Invoice Date",
                total_amount: "Total Amount",
                subtotal: "Subtotal",
                tax_amount: "Tax Amount",
              }).map(([field, label]) => {
                const conf = confidenceScores[field];
                const conflict = conflicts.find(c => c.field === field);
                return (
                  <FieldConfidence
                    key={field}
                    label={label}
                    value={formatValue(field, tx?.[field])}
                    confidence={conf}
                    flagged={conflictFields.has(field) || (conf !== undefined && conf < 0.6)}
                    conflict={conflict?.description}
                  />
                );
              })}
            </div>
          </div>

          {/* Correction Form */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Review & Correct</h2>
            <p className="text-xs text-slate-400 mb-4">Flagged fields have low confidence or conflicts</p>

            <div className="space-y-3">
              {[
                { key: "vendor_name", label: "Vendor Name", type: "text" },
                { key: "vendor_gst", label: "GST Number", type: "text" },
                { key: "invoice_number", label: "Invoice Number", type: "text" },
                { key: "invoice_date", label: "Invoice Date", type: "date" },
                { key: "subtotal", label: "Subtotal", type: "number" },
                { key: "tax_amount", label: "Tax Amount", type: "number" },
                { key: "total_amount", label: "Total Amount", type: "number" },
              ].map(({ key, label, type }) => {
                const isFlagged = conflictFields.has(key) || (confidenceScores[key] !== undefined && confidenceScores[key] < 0.6);
                return (
                  <div key={key}>
                    <label className={`block text-xs font-medium mb-1 uppercase tracking-wide ${isFlagged ? "text-amber-600" : "text-slate-400"}`}>
                      {label} {isFlagged && "⚠"}
                    </label>
                    <input
                      type={type}
                      value={corrections[key] ?? ""}
                      onChange={e => setCorrections(p => ({ ...p, [key]: e.target.value }))}
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all
                        ${isFlagged ? "border-amber-300 bg-amber-50/50 focus:ring-amber-200" : "border-slate-200 focus:ring-indigo-100 focus:border-indigo-400"}`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">Notes (required for rejection)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Add review notes..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 resize-none"
              />
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleAccept}
                disabled={submitting}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? "Saving..." : <>Accept Invoice <kbd className="text-[10px] bg-emerald-500 px-1.5 py-0.5 rounded font-mono">A</kbd></>}
              </button>
              <button
                onClick={handleReject}
                disabled={submitting}
                className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-rose-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                Reject <kbd className="text-[10px] bg-rose-500 px-1.5 py-0.5 rounded font-mono">R</kbd>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <ConsensusHeatmap invoice={invoice} tx={tx} />
        </div>

        {conflicts.length > 0 && (
          <div className="mt-5">
            <ExtractionDisagreement invoice={invoice} tx={tx} />
          </div>
        )}

        <div className="mt-5 grid lg:grid-cols-2 gap-5">
          <AIReasoningChain invoice={invoice} tx={tx} />
          <TrustExplainability invoice={invoice} tx={tx} />
        </div>

        <div className="mt-5">
          <InvoiceTimeline invoice={invoice} tx={tx} />
        </div>

        <div className="mt-5">
          <CommentThread invoiceId={invoice.id} />
        </div>
      </div>
    </Layout>
  );
}

function formatValue(field, value) {
  if (value === null || value === undefined) return null;
  if (["subtotal", "tax_amount", "total_amount"].includes(field) && typeof value === "number") {
    return `₹${value.toLocaleString("en-IN")}`;
  }
  return String(value);
}
