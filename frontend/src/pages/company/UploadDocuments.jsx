import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import api from "../../lib/api";

const DOC_TYPES = [
  {
    value: "bank_statement",
    label: "Bank Statement",
    desc: "Monthly/quarterly bank statement",
    color: "blue",
    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  },
  {
    value: "salary_register",
    label: "Salary Register",
    desc: "Monthly payroll / salary sheet",
    color: "emerald",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
];

const colorMap = {
  blue: { sel: "border-blue-500 bg-blue-50 dark:bg-blue-900/20", icon: "bg-blue-100 text-blue-600", text: "text-blue-700 dark:text-blue-300" },
  emerald: { sel: "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20", icon: "bg-emerald-100 text-emerald-600", text: "text-emerald-700 dark:text-emerald-300" },
};

export default function UploadDocuments() {
  const navigate = useNavigate();
  const [docType, setDocType] = useState("bank_statement");
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const addFiles = useCallback((newFiles) => {
    const valid = Array.from(newFiles).filter(f =>
      f.type === "application/pdf" || f.type.startsWith("image/") || f.name.endsWith(".csv") || f.name.endsWith(".xlsx")
    );
    setFiles(prev => [...prev, ...valid].slice(0, 10));
    setError(null);
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  async function handleUpload() {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    const res = [];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("invoice_type", docType);
        const r = await api.post("/invoices/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        res.push({ name: file.name, ok: true, id: r.data.id });
      } catch {
        res.push({ name: file.name, ok: false });
      }
    }
    setResults(res);
    setUploading(false);
  }

  const selected = DOC_TYPES.find(d => d.value === docType);
  const c = colorMap[selected.color];

  if (results.length > 0) {
    const ok = results.filter(r => r.ok).length;
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{ok} of {results.length} uploaded</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 p-4 mb-6 text-left space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${r.ok ? "bg-emerald-100" : "bg-rose-100"}`}>
                  <svg className={`w-3 h-3 ${r.ok ? "text-emerald-600" : "text-rose-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={r.ok ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
                  </svg>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-300 truncate">{r.name}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setFiles([]); setResults([]); }} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all">
              Upload More
            </button>
            <button onClick={() => navigate("/company/dashboard")} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all">
              Dashboard
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Upload Documents</h1>
          <p className="text-sm text-slate-500 mt-1">Bank statements and salary registers — bulk upload supported</p>
        </div>

        {/* Type selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {DOC_TYPES.map(t => {
            const tc = colorMap[t.color];
            const active = docType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setDocType(t.value)}
                className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${active ? tc.sel : "border-slate-200 bg-white dark:bg-slate-800 hover:border-slate-300"}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? tc.icon.split(" ")[0] : "bg-slate-100 dark:bg-slate-700"}`}>
                  <svg className={`w-5 h-5 ${active ? tc.icon.split(" ")[1] : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${active ? tc.text : "text-slate-800 dark:text-slate-100"}`}>{t.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => document.getElementById("doc-file-input").click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragOver ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20" :
            files.length ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10" :
            "border-slate-200 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-300"
          }`}
        >
          <input id="doc-file-input" type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx" onChange={e => addFiles(e.target.files)} />
          <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Drop files here or click to browse</p>
          <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG, CSV, Excel — up to 10 files</p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-100 rounded-xl px-4 py-2.5">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{f.name}</p>
                  <p className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-500 transition-colors text-lg flex-shrink-0">×</button>
              </div>
            ))}
          </div>
        )}

        {error && <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="flex gap-3 mt-6">
          <button onClick={() => navigate("/company/dashboard")} className="flex-1 border border-slate-200 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!files.length || uploading}
            className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-all"
          >
            {uploading ? `Uploading ${files.length} file${files.length > 1 ? "s" : ""}…` : `Upload ${files.length || ""} Document${files.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </Layout>
  );
}
