import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import LiveProcessing from "../../components/ui/LiveProcessing";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

const DOC_TYPES = [
  { value: "purchase", label: "Purchase Invoice" },
  { value: "sales", label: "Sales Invoice" },
  { value: "payment", label: "Payment Receipt" },
  { value: "salary_register", label: "Salary Register" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "ledger", label: "Transaction Ledger" },
];

// ─── Single upload ─────────────────────────────────────────────────────────────

function SingleUpload({ invoiceType, setInvoiceType }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reuploadOf = location.state?.reuploadOf;
  const reuploadFileName = location.state?.fileName;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f) => {
    if (!f) return;
    setFile(f);
    setError(null);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("invoice_type", invoiceType);
      formData.append("company_id", user.company_id);
      if (reuploadOf) formData.append("reupload_of", reuploadOf);

      const res = await api.post("/invoices/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      const id = res.data.invoice_id;
      // Upload done — now switch to AI processing view
      setUploading(false);
      setProcessingStatus("queued");
      await pollStatus(id);
    } catch (e) {
      setError(e.response?.data?.detail || "Upload failed. Please try again.");
      setProcessingStatus(null);
    } finally {
      setUploading(false);
    }
  }

  async function pollStatus(id) {
    const maxAttempts = 90;
    let attempts = 0;
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const res = await api.get(`/invoices/${id}`);
        const status = res.data.processing_status;
        if (status) setProcessingStatus(status);
        if (status === "complete" || status === "failed") {
          setTimeout(() => navigate(`/company/invoice/${id}`), 1500);
          return;
        }
      } catch (e) { break; }
      attempts++;
    }
  }

  if (processingStatus) {
    return (
      <div className="space-y-4">
        <LiveProcessing processingStatus={processingStatus} />
        {processingStatus === "complete" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-emerald-800">Extraction complete!</p>
            <p className="text-sm text-emerald-600 mt-0.5">Redirecting to results...</p>
          </div>
        )}
        {processingStatus === "failed" && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-center">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-semibold text-rose-800">Processing failed</p>
            <button onClick={() => { setProcessingStatus(null); setFile(null); }} className="mt-2 text-sm text-rose-600 underline hover:no-underline">
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {reuploadOf && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-700 flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Re-uploading correction for: <span className="font-semibold ml-1">{reuploadFileName}</span>
        </div>
      )}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => document.getElementById("file-input-single").click()}
        className={`relative border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 min-h-56 flex items-center justify-center
          ${dragOver ? "border-indigo-400 bg-indigo-50" : file ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"}`}
      >
        <input id="file-input-single" type="file" className="hidden" accept="image/*,application/pdf"
          onChange={e => handleFile(e.target.files[0])} />
        {/* Camera capture for mobile — only renders on touch devices */}
        <input id="file-input-camera" type="file" className="hidden" accept="image/*" capture="environment"
          onChange={e => handleFile(e.target.files[0])} />
        {file ? (
          <div className="text-center p-8">
            {preview ? (
              <img src={preview} alt="preview" className="max-h-36 mx-auto mb-4 rounded-xl object-contain shadow-sm" />
            ) : (
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <p className="font-semibold text-slate-800">{file.name}</p>
            <p className="text-sm text-slate-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
            <button onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); }}
              className="mt-3 text-xs text-slate-400 hover:text-rose-500 underline transition-colors">
              Remove file
            </button>
          </div>
        ) : (
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="font-semibold text-slate-700">
              {invoiceType === "payment" ? "Drop your payment receipt here" : "Drop your invoice here"}
            </p>
            <p className="text-sm text-slate-400 mt-1">or click to browse</p>
            <p className="text-xs text-slate-300 mt-2">PDF, JPG, PNG up to 20MB</p>
            {/* Camera button — visible on touch/mobile devices */}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); document.getElementById("file-input-camera").click(); }}
              className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-full transition-all md:hidden"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Take Photo
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Document Type</label>
        <select value={invoiceType} onChange={e => setInvoiceType(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white">
          {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {invoiceType === "payment" && (
          <div className="mt-2 flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-xs text-emerald-700">
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            AI will extract: payee, amount paid, payment mode (UPI/NEFT/RTGS), UTR/reference number, and bank details.
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-sm text-rose-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {uploading && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Uploading to secure storage…
            </span>
            <span className="text-sm font-bold text-indigo-600 tabular-nums">{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-indigo-400 mt-2">{file?.name} · {(file?.size / 1024).toFixed(0)} KB</p>
        </div>
      )}

      {!uploading && (
        <button onClick={handleUpload} disabled={!file}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Upload & Extract with AI
        </button>
      )}
    </div>
  );
}

// ─── Bulk upload ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  queued:       { label: "Queued",      color: "text-slate-500",  bg: "bg-slate-100",   dot: "bg-slate-400" },
  uploading:    { label: "Uploading",   color: "text-indigo-600", bg: "bg-indigo-50",   dot: "bg-indigo-500" },
  processing:   { label: "Processing",  color: "text-violet-600", bg: "bg-violet-50",   dot: "bg-violet-500" },
  complete:     { label: "Complete",    color: "text-emerald-600",bg: "bg-emerald-50",  dot: "bg-emerald-500" },
  error:        { label: "Error",       color: "text-rose-600",   bg: "bg-rose-50",     dot: "bg-rose-500" },
};

function FileStatusCard({ item }) {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.queued;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg} border-transparent`}>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${item.status === "processing" || item.status === "uploading" ? "animate-pulse" : ""}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{item.file.name}</p>
        <p className="text-xs text-slate-400">{(item.file.size / 1024).toFixed(0)} KB</p>
      </div>
      <span className={`text-xs font-semibold ${cfg.color}`}>{item.error || cfg.label}</span>
    </div>
  );
}

function BulkUpload({ invoiceType, setInvoiceType }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [items, setItems] = useState(null); // null = not submitted yet
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [done, setDone] = useState(false);

  function addFiles(newFiles) {
    const allowed = Array.from(newFiles).slice(0, 20 - files.length);
    setFiles(prev => [...prev, ...allowed]);
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  async function pollOne(invoiceId, idx) {
    const maxAttempts = 60;
    let attempts = 0;
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2500));
      try {
        const res = await api.get(`/invoices/${invoiceId}`);
        const status = res.data.processing_status;
        if (status === "complete" || status === "failed") {
          setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: status === "complete" ? "complete" : "error", invoiceId } : it));
          return;
        }
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: "processing" } : it));
      } catch { break; }
      attempts++;
    }
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);

    const initialItems = files.map(f => ({ file: f, status: "uploading", invoiceId: null, error: null }));
    setItems(initialItems);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      formData.append("invoice_type", invoiceType);
      formData.append("company_id", user.company_id);

      const res = await api.post("/invoices/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const results = res.data.results;
      const mapped = files.map((f, idx) => {
        const r = results[idx];
        if (!r) return { file: f, status: "error", error: "No response", invoiceId: null };
        if (r.status === "error") return { file: f, status: "error", error: r.error, invoiceId: null };
        return { file: f, status: "processing", invoiceId: r.invoice_id, error: null };
      });
      setItems(mapped);

      // Poll each successfully queued invoice
      await Promise.all(
        mapped.map((item, idx) => item.invoiceId ? pollOne(item.invoiceId, idx) : Promise.resolve())
      );
      setDone(true);
    } catch (e) {
      setItems(prev => prev.map(it => ({ ...it, status: "error", error: e.response?.data?.detail || "Upload failed" })));
    } finally {
      setUploading(false);
    }
  }

  if (items) {
    const total = items.length;
    const completed = items.filter(i => i.status === "complete").length;
    const errors = items.filter(i => i.status === "error").length;
    const inProgress = items.filter(i => i.status === "processing" || i.status === "uploading").length;

    return (
      <div className="space-y-5">
        {/* Progress header */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-800">
              {done ? "Bulk upload complete" : "Processing files…"}
            </p>
            <span className="text-sm text-slate-500">{completed}/{total} done</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
          {errors > 0 && <p className="text-xs text-rose-500 mt-2">{errors} file{errors > 1 ? "s" : ""} failed</p>}
          {inProgress > 0 && <p className="text-xs text-slate-400 mt-2">{inProgress} still processing…</p>}
        </div>

        {/* Per-file status */}
        <div className="space-y-2">
          {items.map((item, idx) => <FileStatusCard key={idx} item={item} />)}
        </div>

        {done && (
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/company/dashboard")}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold text-sm transition-all"
            >
              View All Invoices
            </button>
            {completed === 1 && items.find(i => i.status === "complete")?.invoiceId && (
              <button
                onClick={() => navigate(`/company/invoice/${items.find(i => i.status === "complete").invoiceId}`)}
                className="flex-1 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 py-3 rounded-xl font-semibold text-sm transition-all"
              >
                View Invoice
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => document.getElementById("file-input-bulk").click()}
        className={`relative border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 min-h-40 flex items-center justify-center
          ${dragOver ? "border-indigo-400 bg-indigo-50" : files.length ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"}`}
      >
        <input id="file-input-bulk" type="file" className="hidden" accept="image/*,application/pdf" multiple
          onChange={e => addFiles(e.target.files)} />
        <div className="text-center p-6">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="font-semibold text-slate-700 text-sm">Drop multiple invoices here</p>
          <p className="text-xs text-slate-400 mt-1">or click to browse — up to 20 files</p>
          <p className="text-xs text-slate-300 mt-1">PDF, JPG, PNG up to 20MB each</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">{files.length} file{files.length > 1 ? "s" : ""} selected</p>
            <button onClick={() => setFiles([])} className="text-xs text-slate-400 hover:text-rose-500 transition-colors">Clear all</button>
          </div>
          {files.map((f, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-xl">
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="flex-1 text-sm text-slate-700 truncate">{f.name}</span>
              <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={() => removeFile(idx)} className="text-slate-300 hover:text-rose-500 transition-colors ml-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Document Type (applies to all)</label>
        <select value={invoiceType} onChange={e => setInvoiceType(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white">
          {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <button onClick={handleUpload} disabled={files.length === 0 || uploading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : "Files"} & Extract with AI
      </button>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function UploadInvoice() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("single"); // "single" | "bulk"
  const [invoiceType, setInvoiceType] = useState("purchase");

  return (
    <Layout>
      <div className="px-8 py-8 max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <button onClick={() => navigate("/company/dashboard")} className="hover:text-slate-600 transition-colors">
            Invoices
          </button>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-600 font-medium">Upload</span>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Upload Invoice</h1>
            <p className="text-slate-500 text-sm">AI extracts all fields automatically across multiple engines.</p>
          </div>
          {/* Mode toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
            {[["single", "Single"], ["bulk", "Bulk"]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setMode(val)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === val ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {mode === "single"
          ? <SingleUpload invoiceType={invoiceType} setInvoiceType={setInvoiceType} />
          : <BulkUpload invoiceType={invoiceType} setInvoiceType={setInvoiceType} />
        }

        {/* AI info */}
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 mt-5">
          <p className="text-xs font-semibold text-indigo-700 mb-2.5 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How AI extraction works
          </p>
          <div className="space-y-1.5">
            {[
              ["Groq Vision AI", "Reads and understands document images"],
              ["PyMuPDF", "Extracts text directly from text-based PDFs"],
              ["OCR Fallback", "Handles scanned documents and handwriting"],
            ].map(([title, desc]) => (
              <div key={title} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0" />
                <p className="text-xs text-indigo-600"><span className="font-medium">{title}</span> — {desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
