import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import TrustScoreBadge from "../../components/ui/TrustScoreBadge";
import FieldConfidence from "../../components/ui/FieldConfidence";
import StatusBadge from "../../components/ui/StatusBadge";
import AgentPipeline from "../../components/ui/AgentPipeline";
import AuditTrail from "../../components/ui/AuditTrail";
import BankStatementView from "../../components/ui/BankStatementView";
import CommentThread from "../../components/ui/CommentThread";
import RiskRadar from "../../components/ui/RiskRadar";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

const FIELD_LABELS = {
  vendor_name: "Vendor Name",
  vendor_gst: "Vendor GST",
  invoice_number: "Invoice Number",
  invoice_date: "Invoice Date",
  due_date: "Due Date",
  subtotal: "Subtotal",
  tax_amount: "Tax Amount",
  total_amount: "Total Amount",
  currency: "Currency",
  category: "Category",
  buyer_name: "Buyer Name",
  buyer_gst: "Buyer GST",
  payment_method: "Payment Method",
};

function formatValue(field, value) {
  if (value === null || value === undefined) return null;
  if (["subtotal", "tax_amount", "total_amount"].includes(field) && typeof value === "number") {
    return value.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  }
  return String(value);
}

function ConfidenceDot({ score }) {
  if (score === undefined || score === null) return null;
  const pct = Math.round(score * 100);
  const color = score >= 0.85 ? "bg-emerald-500" : score >= 0.6 ? "bg-amber-400" : "bg-rose-400";
  const text = score >= 0.85 ? "text-emerald-600" : score >= 0.6 ? "text-amber-600" : "text-rose-500";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${text} ml-2 flex-shrink-0`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {pct}%
    </span>
  );
}

function DataRow({ label, value, confidence, flagged, conflict }) {
  if (!value && confidence === undefined) return null;
  return (
    <div className={`flex items-start py-3 border-b border-slate-50 last:border-0 ${flagged ? "bg-amber-50/60 -mx-2 px-2 rounded-lg" : ""}`}>
      <span className="text-xs text-slate-400 font-medium w-32 flex-shrink-0 pt-0.5 uppercase tracking-wide">{label}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <span className={`text-sm font-medium flex-1 truncate ${value ? "text-slate-800" : "text-slate-300 italic"}`}>
            {value ?? "Not extracted"}
          </span>
          <ConfidenceDot score={confidence} />
        </div>
        {conflict && <p className="text-xs text-amber-600 mt-0.5">⚠ {conflict}</p>}
      </div>
    </div>
  );
}

function CategorySelector({ invoiceId, currentHeadId, currentHeadName, companyId }) {
  const [heads, setHeads] = useState([]);
  const [selected, setSelected] = useState(currentHeadId || "");
  const [label, setLabel] = useState(currentHeadName || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    api.get(`/companies/${companyId}/payment-heads`)
      .then(r => setHeads(r.data))
      .catch(() => {});
  }, [companyId]);

  async function handleChange(e) {
    const val = e.target.value;
    setSelected(val);
    setSaving(true);
    try {
      const res = await api.patch(`/invoices/${invoiceId}/category`, { payment_head_id: val || null });
      setLabel(res.data.payment_head_name);
    } catch { }
    finally { setSaving(false); }
  }

  return (
    <div className="flex items-start py-3 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 font-medium w-32 flex-shrink-0 pt-2 uppercase tracking-wide">Category</span>
      <div className="flex-1 flex items-center gap-2">
        <select
          value={selected}
          onChange={handleChange}
          disabled={saving}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white text-slate-800 disabled:opacity-60"
        >
          <option value="">Uncategorized</option>
          {heads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        {selected && !saving && (
          <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-2 py-1 rounded-lg flex-shrink-0">Auto</span>
        )}
        {saving && <span className="text-xs text-slate-400">Saving…</span>}
      </div>
    </div>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [firmInfo, setFirmInfo] = useState(null);
  const [docUrl, setDocUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);

  useEffect(() => {
    function onScroll() { setShowBackTop(window.scrollY > 300); }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function copyInvoiceNumber() {
    const num = invoice?.transaction?.invoice_number;
    if (!num) return;
    navigator.clipboard.writeText(num).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    fetchInvoice();
    const interval = setInterval(() => {
      if (invoice?.processing_status && !["complete", "failed"].includes(invoice.processing_status)) {
        fetchInvoice();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  async function fetchInvoice() {
    try {
      const res = await api.get(`/invoices/${id}`);
      setInvoice(res.data);
      api.get(`/companies/${res.data.company_id}/firm-info`).then(r => setFirmInfo(r.data)).catch(() => {});
      if (res.data.file_url) {
        api.get(`/invoices/${id}/download`, { responseType: "blob" })
          .then(r => setDocUrl(URL.createObjectURL(r.data)))
          .catch(() => {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPaid() {
    setMarkingPaid(true);
    try {
      await api.patch(`/invoices/${id}/payment-status`, {
        status: "paid",
        paid_date: new Date().toISOString().split("T")[0],
      });
      fetchInvoice();
    } catch (e) {
      alert(e.response?.data?.detail || "Could not mark as paid");
    } finally {
      setMarkingPaid(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/invoices/${invoice.id}`);
      navigate("/company/dashboard");
    } catch (e) {
      alert(e.response?.data?.detail || "Could not delete invoice");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="px-8 py-8 max-w-5xl mx-auto space-y-4">
          <div className="shimmer h-6 w-48 rounded-lg" />
          <div className="shimmer h-28 rounded-2xl" />
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 shimmer h-64 rounded-2xl" />
            <div className="shimmer h-64 rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!invoice) {
    return (
      <Layout>
        <div className="px-8 py-20 text-center text-rose-500">Invoice not found</div>
      </Layout>
    );
  }

  const isProcessing = invoice.processing_status && !["complete", "failed"].includes(invoice.processing_status);
  const tx = invoice.transaction;
  const confidenceScores = invoice.confidence_scores || {};
  const conflicts = invoice.conflicts || [];
  const conflictFields = new Set(conflicts.map(c => c.field));

  function buildAISummary() {
    if (!tx || isProcessing) return null;
    const score = invoice.trust_score;
    const vendor = tx.vendor_name || "Unknown vendor";
    const amount = tx.total_amount ? `₹${tx.total_amount.toLocaleString("en-IN")}` : null;
    const conflictCount = conflicts.length;
    const avgConf = confidenceScores && Object.values(confidenceScores).length
      ? Object.values(confidenceScores).reduce((a, b) => a + b, 0) / Object.values(confidenceScores).length
      : null;

    if (invoice.invoice_type === "bank_statement") {
      const txCount = invoice.extraction_data?.transaction_count || 0;
      return `Bank statement parsed — ${txCount} transaction${txCount !== 1 ? "s" : ""} extracted and auto-categorized.`;
    }

    let parts = [];
    if (vendor && amount) parts.push(`${vendor} invoice for ${amount}`);
    else if (vendor) parts.push(`${vendor} invoice`);

    if (score >= 85) {
      parts.push(`high confidence extraction (${score}/100)`);
      if (conflictCount === 0) parts.push("all engines in agreement");
      if (tx.vendor_gst) parts.push("GST verified");
      if (invoice.status === "accepted") parts.push("auto-accepted");
    } else if (score >= 60) {
      parts.push(`moderate confidence (${score}/100), sent for review`);
      if (conflictCount > 0) parts.push(`${conflictCount} field conflict${conflictCount > 1 ? "s" : ""} detected`);
    } else {
      parts.push(`low confidence (${score}/100), manual review required`);
      if (conflictCount > 0) parts.push(`${conflictCount} conflict${conflictCount > 1 ? "s" : ""} — ${conflicts.map(c => c.field?.replace("_", " ")).join(", ")}`);
      if (avgConf && avgConf < 0.6) parts.push("extraction accuracy below threshold");
    }

    return parts.length ? parts.join(" — ") + "." : null;
  }

  const aiSummary = buildAISummary();

  const currency = tx?.currency || "INR";
  const currSym = currency === "USD" ? "$" : "₹";

  function fmtAmount(v) {
    if (v == null) return null;
    return `${currSym}${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <button onClick={() => navigate("/company/dashboard")} className="hover:text-slate-600 transition-colors">
            Invoices
          </button>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-600 font-medium truncate max-w-xs">{invoice.file_name}</span>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{invoice.file_name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium capitalize">
                  {invoice.invoice_type?.replace("_", " ")}
                </span>
                <StatusBadge status={invoice.status} />
                {invoice.payment_status === "paid" && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Paid
                  </span>
                )}
                {invoice.trust_score >= 75 && invoice.transaction?.vendor_gst && (
                  <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Trusted Vendor
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {invoice.status === "accepted" && invoice.payment_status !== "paid" && (
              <button
                onClick={handleMarkPaid}
                disabled={markingPaid}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {markingPaid ? "Saving..." : "Mark Paid"}
              </button>
            )}
            {invoice.status !== "accepted" && (
              <button onClick={handleDelete} disabled={deleting}
                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50"
                title="Delete invoice">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all print:hidden"
              title="Print / Save as PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
            <TrustScoreBadge score={invoice.trust_score} size="lg" />
          </div>
        </div>

        {/* AI Summary */}
        {aiSummary && !isProcessing && (
          <div className="mt-4 flex items-start gap-2.5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
            <p className="text-xs text-indigo-700 leading-relaxed">
              <span className="font-semibold">AI: </span>{aiSummary}
            </p>
          </div>
        )}

        {/* Conflicts */}
        {conflicts.length > 0 && !isProcessing && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
            <h3 className="font-semibold text-amber-800 text-sm mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected
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

        {invoice.status === "rejected" && invoice.reviewer_notes && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-5">
            <h3 className="font-semibold text-rose-800 text-sm mb-1 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Rejected by Accountant
            </h3>
            <p className="text-sm text-rose-700 italic">"{invoice.reviewer_notes}"</p>
            <button
              onClick={() => navigate("/company/upload", { state: { reuploadOf: invoice.id, fileName: invoice.file_name } })}
              className="mt-3 text-xs font-semibold text-rose-600 hover:text-rose-800 underline"
            >
              Upload corrected invoice →
            </button>
          </div>
        )}

        {invoice.is_duplicate && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-amber-800 text-sm">Possible Duplicate Invoice</p>
              <p className="text-xs text-amber-700 mt-0.5">An invoice with the same number and vendor already exists in the system.</p>
            </div>
          </div>
        )}

        {isProcessing ? (
          <div className="max-w-md mx-auto">
            <AgentPipeline processingStatus={invoice.processing_status} />
          </div>
        ) : invoice.invoice_type === "bank_statement" ? (
          <>
            <BankStatementView invoice={invoice} />
            <div className="mt-5"><AuditTrail invoiceId={invoice.id} /></div>
          </>
        ) : (
          <>
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Left: Extracted Data */}
            <div className="space-y-5">
              {tx && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-slate-900">Extracted Data</h2>
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                      Groq AI · PyMuPDF · OCR
                    </span>
                  </div>
                  <div>
                    <DataRow label="Vendor" value={tx.vendor_name} confidence={confidenceScores.vendor_name} flagged={conflictFields.has("vendor_name") || (confidenceScores.vendor_name !== undefined && confidenceScores.vendor_name < 0.6)} conflict={conflicts.find(c => c.field === "vendor_name")?.description} />
                    <DataRow label="GST Number" value={tx.vendor_gst} confidence={confidenceScores.vendor_gst} flagged={conflictFields.has("vendor_gst") || (confidenceScores.vendor_gst !== undefined && confidenceScores.vendor_gst < 0.6)} conflict={conflicts.find(c => c.field === "vendor_gst")?.description} />
                    <DataRow label="Buyer" value={tx.buyer_name} confidence={confidenceScores.buyer_name} flagged={conflictFields.has("buyer_name") || (confidenceScores.buyer_name !== undefined && confidenceScores.buyer_name < 0.6)} />
                    <div className="flex items-center gap-1 group/inv">
                      <div className="flex-1">
                        <DataRow label="Invoice No." value={tx.invoice_number} confidence={confidenceScores.invoice_number} flagged={conflictFields.has("invoice_number") || (confidenceScores.invoice_number !== undefined && confidenceScores.invoice_number < 0.6)} conflict={conflicts.find(c => c.field === "invoice_number")?.description} />
                      </div>
                      {tx.invoice_number && (
                        <button onClick={copyInvoiceNumber} className="opacity-0 group-hover/inv:opacity-100 transition-opacity p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg flex-shrink-0" title="Copy invoice number">
                          {copied ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          )}
                        </button>
                      )}
                    </div>
                    <DataRow label="Invoice Date" value={tx.invoice_date} confidence={confidenceScores.invoice_date} flagged={conflictFields.has("invoice_date") || (confidenceScores.invoice_date !== undefined && confidenceScores.invoice_date < 0.6)} />
                    <DataRow label="Due Date" value={tx.due_date} confidence={confidenceScores.due_date} flagged={conflictFields.has("due_date")} />
                    <DataRow label="Subtotal" value={fmtAmount(tx.subtotal)} confidence={confidenceScores.subtotal} flagged={conflictFields.has("subtotal") || (confidenceScores.subtotal !== undefined && confidenceScores.subtotal < 0.6)} conflict={conflicts.find(c => c.field === "subtotal")?.description} />
                    <DataRow label="Tax" value={fmtAmount(tx.tax_amount)} confidence={confidenceScores.tax_amount} flagged={conflictFields.has("tax_amount") || (confidenceScores.tax_amount !== undefined && confidenceScores.tax_amount < 0.6)} conflict={conflicts.find(c => c.field === "tax_amount")?.description} />
                    {tx?.tax_amount && (
                      <div className="mt-3 pt-3 border-t border-slate-50">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">GST Breakdown</p>
                          <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-medium">Intra-state</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50 rounded-lg px-3 py-2">
                            <p className="text-xs text-slate-400">CGST (9%)</p>
                            <p className="text-sm font-semibold text-slate-700">₹{((tx.cgst ?? tx.tax_amount / 2)).toLocaleString("en-IN")}</p>
                          </div>
                          <div className="bg-slate-50 rounded-lg px-3 py-2">
                            <p className="text-xs text-slate-400">SGST (9%)</p>
                            <p className="text-sm font-semibold text-slate-700">₹{((tx.sgst ?? tx.tax_amount / 2)).toLocaleString("en-IN")}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <DataRow label="Total" value={fmtAmount(tx.total_amount)} confidence={confidenceScores.total_amount} flagged={conflictFields.has("total_amount") || (confidenceScores.total_amount !== undefined && confidenceScores.total_amount < 0.6)} conflict={conflicts.find(c => c.field === "total_amount")?.description} />
                    <DataRow label="Currency" value={tx.currency} confidence={confidenceScores.currency} flagged={conflictFields.has("currency")} />
                    <CategorySelector
                      invoiceId={id}
                      currentHeadId={tx.payment_head_id}
                      currentHeadName={tx.payment_head_name}
                      companyId={invoice.company_id}
                    />
                  </div>
                  {tx.line_items?.length > 0 && (
                    <div className="mt-5">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Line Items</h3>
                      <div className="bg-slate-50 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Description</th>
                              <th className="text-right px-4 py-2.5 text-slate-500 font-semibold">Qty</th>
                              <th className="text-right px-4 py-2.5 text-slate-500 font-semibold">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {tx.line_items.map((item, i) => (
                              <tr key={i}>
                                <td className="px-4 py-2.5 text-slate-700">{item.description}</td>
                                <td className="px-4 py-2.5 text-right text-slate-500">{item.quantity ?? "—"}</td>
                                <td className="px-4 py-2.5 text-right text-slate-700 font-medium">
                                  {item.amount ? `${currSym}${item.amount.toLocaleString("en-IN")}` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Payment receipt specific fields */}
              {invoice.invoice_type === "payment" && (invoice.payment_method || invoice.utr_number || invoice.bank_name) && (
                <div className="mt-4 bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Payment Details
                  </h3>
                  <div className="space-y-2">
                    {invoice.payment_method && (
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-600 font-medium">Mode</span>
                        <span className="text-slate-800 font-semibold uppercase">{invoice.payment_method}</span>
                      </div>
                    )}
                    {invoice.utr_number && (
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-600 font-medium">UTR / Ref No.</span>
                        <span className="text-slate-800 font-mono font-semibold">{invoice.utr_number}</span>
                      </div>
                    )}
                    {invoice.bank_name && (
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-600 font-medium">Bank</span>
                        <span className="text-slate-800 font-semibold">{invoice.bank_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tx.is_corrected && (
                    <div className="mt-4 bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      This transaction was reviewed and corrected by an accountant.
                    </div>
                  )}
                </div>
              )}
              {invoice.reviewer_notes && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <h2 className="text-base font-semibold text-slate-900 mb-2">Accountant Notes</h2>
                  <p className="text-sm text-slate-600">{invoice.reviewer_notes}</p>
                  {invoice.reviewed_at && (
                    <p className="text-xs text-slate-400 mt-2">Reviewed on {new Date(invoice.reviewed_at).toLocaleDateString("en-IN")}</p>
                  )}
                </div>
              )}
            </div>

            {/* Right: Risk Radar + Field Confidence + Firm Info */}
            <div className="space-y-5">
              <RiskRadar invoice={invoice} tx={tx} />

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Field Confidence</h2>
                <p className="text-[10px] text-slate-400 mb-3">Validated across Groq AI, PyMuPDF and OCR</p>
                <div>
                  {Object.entries(FIELD_LABELS).map(([field, label]) => {
                    const conf = confidenceScores[field];
                    const txValue = tx?.[field];
                    if (conf === undefined && txValue === undefined) return null;
                    const conflict = conflicts.find(c => c.field === field);
                    return (
                      <FieldConfidence
                        key={field}
                        label={label}
                        value={formatValue(field, txValue)}
                        confidence={conf}
                        flagged={conflictFields.has(field) || (conf !== undefined && conf < 0.6)}
                        conflict={conflict?.description}
                      />
                    );
                  })}
                </div>
              </div>

              {firmInfo && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Your Accounting Firm
                  </h3>
                  <p className="text-sm font-semibold text-slate-800">{firmInfo.firm_name}</p>
                  {firmInfo.firm_email && <p className="text-xs text-slate-400 mt-0.5">{firmInfo.firm_email}</p>}
                  {firmInfo.firm_phone && <p className="text-xs text-slate-400">{firmInfo.firm_phone}</p>}
                  {firmInfo.accountants?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-50">
                      <p className="text-xs font-semibold text-slate-500 mb-2">Accountants</p>
                      {firmInfo.accountants.map(a => (
                        <div key={a.email} className="flex items-center gap-2 py-1">
                          <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">
                            {a.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-700">{a.name}</p>
                            <p className="text-[10px] text-slate-400">{a.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {invoice.reviewer && (
                    <div className="mt-3 pt-3 border-t border-slate-50">
                      <p className="text-xs text-slate-400">Reviewed by <span className="font-semibold text-slate-600">{invoice.reviewer.name}</span></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {invoice.file_url && (
            <div className="mt-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
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

          <div className="mt-5">
            <AuditTrail invoiceId={id} />
          </div>
          <div className="mt-5">
            <CommentThread invoiceId={invoice.id} />
          </div>
          </>
        )}
      </div>

      {showBackTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 w-10 h-10 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-600 transition-all z-50 print:hidden"
          title="Back to top"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </Layout>
  );
}
