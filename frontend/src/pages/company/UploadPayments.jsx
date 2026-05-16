import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import api from "../../lib/api";

const PAYMENT_TYPES = [
  { value: "payment", label: "Payment Receipt", desc: "Outgoing payment confirmation", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { value: "ledger", label: "Transaction Ledger", desc: "Account ledger export", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
];

export default function UploadPayments() {
  const navigate = useNavigate();
  const [docType, setDocType] = useState("payment");
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (!allowed.some(t => f.type === t || f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
      setError("Supported formats: PDF, JPG, PNG, CSV, Excel");
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("invoice_type", docType);
      const res = await api.post("/invoices/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: e => setProgress(Math.round((e.loaded * 100) / e.total)),
      });
      setDone(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Upload Complete</h2>
          <p className="text-slate-500 text-sm mb-6">Your document has been uploaded and queued for AI processing.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setFile(null); setDone(null); setProgress(0); }}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all"
            >
              Upload Another
            </button>
            <button
              onClick={() => navigate("/company/dashboard")}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Upload Payments</h1>
          <p className="text-sm text-slate-500 mt-1">Upload payment receipts or transaction ledgers for reconciliation</p>
        </div>

        {/* Document type selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {PAYMENT_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setDocType(t.value)}
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                docType === t.value
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-slate-200 bg-white dark:bg-slate-800 hover:border-slate-300"
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${docType === t.value ? "bg-indigo-100" : "bg-slate-100 dark:bg-slate-700"}`}>
                <svg className={`w-4.5 h-4.5 ${docType === t.value ? "text-indigo-600" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                </svg>
              </div>
              <div>
                <p className={`text-sm font-semibold ${docType === t.value ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100"}`}>{t.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => document.getElementById("pay-file-input").click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            dragOver ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20" :
            file ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" :
            "border-slate-200 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-300"
          }`}
        >
          <input id="pay-file-input" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx,.xls" onChange={e => handleFile(e.target.files[0])} />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={e => { e.stopPropagation(); setFile(null); }} className="ml-2 text-slate-400 hover:text-rose-500 transition-colors text-lg">×</button>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Drop file here or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG, CSV, Excel supported</p>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {uploading && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Uploading...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={() => navigate("/company/dashboard")} className="flex-1 border border-slate-200 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-all"
          >
            {uploading ? "Uploading…" : "Upload Document"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
