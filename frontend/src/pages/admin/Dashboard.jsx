import { useState, useEffect } from "react";
import Layout from "../../components/layout/Layout";
import api from "../../lib/api";

export default function AdminDashboard() {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddFirm, setShowAddFirm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", admin_email: "", admin_password: "", admin_full_name: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/firms/").then(r => setFirms(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleAddFirm(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/firms/", form);
      setFirms(p => [res.data, ...p]);
      setShowAddFirm(false);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to create firm");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Platform Admin</h1>
            <p className="text-slate-500 text-sm mt-1">Manage accounting firms on FinBridge</p>
          </div>
          <button
            onClick={() => setShowAddFirm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Onboard Firm
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
            <p className="text-3xl font-bold text-indigo-600">{firms.length}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium uppercase tracking-wide">Accounting Firms</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
            <p className="text-3xl font-bold text-emerald-600">{firms.filter(f => f.is_active).length}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium uppercase tracking-wide">Active Firms</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
            <p className="text-3xl font-bold text-slate-900">
              {firms.reduce((acc, f) => acc + (f.companies?.length || 0), 0)}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-medium uppercase tracking-wide">Total Companies</p>
          </div>
        </div>

        <h2 className="text-base font-semibold text-slate-900 mb-4">Accounting Firms</h2>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="shimmer h-14 rounded-2xl" />)}</div>
        ) : firms.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-700 font-semibold">No firms onboarded yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Firm", "Email", "Status", "Created"].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {firms.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-800">{f.name}</td>
                    <td className="px-5 py-4 text-slate-500">{f.email}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${f.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {f.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{new Date(f.created_at).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddFirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 sticky top-0 bg-white rounded-t-2xl border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Onboard Accounting Firm</h2>
              <button onClick={() => setShowAddFirm(false)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all text-xl">×</button>
            </div>
            <form onSubmit={handleAddFirm} className="space-y-3 px-6 py-5">
              {[
                { key: "name", label: "Firm Name", required: true },
                { key: "email", label: "Firm Email", type: "email", required: true },
                { key: "phone", label: "Phone" },
                { key: "address", label: "Address" },
                { key: "admin_full_name", label: "Admin Name", required: true },
                { key: "admin_email", label: "Admin Email", type: "email", required: true },
                { key: "admin_password", label: "Admin Password", type: "password", required: true },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                  <input
                    type={f.type || "text"} required={f.required}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>
              ))}
              {error && <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddFirm(false)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                  {submitting ? "Creating..." : "Create Firm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
