import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import api from "../../lib/api";

export default function FirmDashboard() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [accountants, setAccountants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [firmStats, setFirmStats] = useState(null);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showAddAccountant, setShowAddAccountant] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", gst_number: "", pan_number: "",
    business_type: "it", address: "",
    admin_email: "", admin_password: "", admin_full_name: "",
  });
  const [acctForm, setAcctForm] = useState({ full_name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [acctError, setAcctError] = useState(null);

  useEffect(() => {
    api.get("/companies/").then(r => setCompanies(r.data)).catch(console.error).finally(() => setLoading(false));
    api.get("/companies/firm/stats").then(r => setFirmStats(r.data)).catch(() => {});
    api.get("/users/").then(r => setAccountants(r.data.filter(u => u.role === "accountant"))).catch(() => {});
  }, []);

  async function handleAddAccountant(e) {
    e.preventDefault();
    setSubmitting(true);
    setAcctError(null);
    try {
      const res = await api.post("/users/", { ...acctForm, role: "accountant" });
      setAccountants(p => [res.data, ...p]);
      setShowAddAccountant(false);
      setAcctForm({ full_name: "", email: "", password: "" });
    } catch (e) {
      setAcctError(e.response?.data?.detail || "Failed to create accountant");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddCompany(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/companies/", form);
      setCompanies(p => [res.data, ...p]);
      setShowAddCompany(false);
      setForm({ name: "", email: "", phone: "", gst_number: "", pan_number: "", business_type: "it", address: "", admin_email: "", admin_password: "", admin_full_name: "" });
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to create company");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Firm Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your client companies and accountants</p>
          </div>
          <button
            onClick={() => setShowAddCompany(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Onboard Company
          </button>
        </div>

        {/* Firm Stats */}
        {firmStats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            {[
              { label: "Companies", value: firmStats.total_companies, color: "text-slate-800 dark:text-slate-100", bg: "bg-slate-100" },
              { label: "Total Invoices", value: firmStats.total_invoices, color: "text-slate-700 dark:text-slate-200", bg: "bg-slate-100" },
              { label: "Pending Review", value: firmStats.pending_review, color: "text-indigo-600", bg: "bg-indigo-50" },
              { label: "Accepted", value: firmStats.accepted, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "High Risk", value: firmStats.high_risk, color: "text-rose-600", bg: "bg-rose-50" },
              { label: "Avg Trust", value: firmStats.avg_trust_score ? `${firmStats.avg_trust_score}/100` : "—", color: "text-slate-800 dark:text-slate-100", bg: "bg-slate-100" },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Review Queue", desc: "Invoice review workflow", path: "/accountant/dashboard", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", bg: "bg-indigo-50", ic: "text-indigo-500" },
            { label: "Reports", desc: "Publish MIS reports", path: "/reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", bg: "bg-emerald-50", ic: "text-emerald-500" },
            { label: "Companies", desc: `${companies.length} active`, path: null, icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", bg: "bg-slate-100", ic: "text-slate-500" },
          ].map(item => (
            <div
              key={item.label}
              onClick={() => item.path && navigate(item.path)}
              className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm p-5 transition-all ${item.path ? "cursor-pointer hover:border-indigo-200 hover:shadow" : ""}`}
            >
              <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center mb-3`}>
                <svg className={`w-5 h-5 ${item.ic}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
              </div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{item.label}</p>
              <p className="text-sm text-slate-400 mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Companies list */}
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Client Companies</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2].map(i => <div key={i} className="shimmer h-24 rounded-2xl" />)}
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-700 dark:text-slate-200 font-semibold">No companies onboarded yet</p>
            <p className="text-slate-400 text-sm mt-1">Click "Onboard Company" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map(c => (
              <div key={c.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-indigo-200 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{c.name}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">{c.email}</p>
                    <div className="flex gap-2 mt-2.5">
                      <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full capitalize font-medium">{c.business_type}</span>
                      {c.gst_number && <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-medium">{c.gst_number}</span>}
                    </div>
                    {firmStats?.companies?.find(s => s.id === c.id) && (() => {
                      const s = firmStats.companies.find(cs => cs.id === c.id);
                      return (
                        <div className="flex gap-3 mt-3 pt-3 border-t border-slate-50">
                          <span className="text-xs text-slate-500"><span className="font-semibold text-slate-700 dark:text-slate-200">{s.total}</span> invoices</span>
                          {s.pending_review > 0 && <span className="text-xs text-indigo-600 font-semibold">{s.pending_review} pending</span>}
                          {s.high_risk > 0 && <span className="text-xs text-rose-500 font-semibold">{s.high_risk} high risk</span>}
                          <span className="text-xs text-emerald-600 font-semibold ml-auto">{s.accepted} accepted</span>
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => navigate(`/firm/company/${c.id}/payment-heads`)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                  >
                    Configure →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accountants section */}
      <div className="px-8 pb-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Accountants</h2>
          <button
            onClick={() => setShowAddAccountant(true)}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Accountant
          </button>
        </div>
        {accountants.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-500 text-sm">No accountants added yet</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Name", "Email", "Joined"].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {accountants.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">{a.full_name}</td>
                    <td className="px-5 py-3.5 text-slate-500">{a.email}</td>
                    <td className="px-5 py-3.5 text-slate-400">{new Date(a.created_at).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Accountant Modal */}
      {showAddAccountant && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Accountant</h2>
              <button onClick={() => setShowAddAccountant(false)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all text-xl">×</button>
            </div>
            <form onSubmit={handleAddAccountant} className="space-y-3 px-6 py-5">
              {[
                { key: "full_name", label: "Full Name", required: true },
                { key: "email", label: "Email", type: "email", required: true },
                { key: "password", label: "Password", type: "password", required: true },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                  <input
                    type={f.type || "text"} required={f.required}
                    value={acctForm[f.key]}
                    onChange={e => setAcctForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>
              ))}
              {acctError && <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">{acctError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddAccountant(false)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {submitting ? "Adding..." : "Add Accountant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddCompany && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 sticky top-0 bg-white dark:bg-slate-800 rounded-t-2xl border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Onboard New Company</h2>
              <button onClick={() => setShowAddCompany(false)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all text-xl">×</button>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-3 px-6 py-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Company Details</p>
              {[
                { key: "name", label: "Company Name", required: true },
                { key: "email", label: "Company Email", type: "email", required: true },
                { key: "phone", label: "Phone" },
                { key: "gst_number", label: "GST Number" },
                { key: "pan_number", label: "PAN Number" },
                { key: "address", label: "Address" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                  <input
                    type={f.type || "text"}
                    required={f.required}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Business Type</label>
                <select
                  value={form.business_type}
                  onChange={e => setForm(p => ({ ...p, business_type: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                >
                  <option value="it">IT / Software</option>
                  <option value="manufacturing">Manufacturing</option>
                  <option value="services">Services</option>
                  <option value="trading">Trading</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2">Company Admin Account</p>
              {[
                { key: "admin_full_name", label: "Admin Full Name", required: true },
                { key: "admin_email", label: "Admin Email", type: "email", required: true },
                { key: "admin_password", label: "Admin Password", type: "password", required: true },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                  <input
                    type={f.type || "text"}
                    required={f.required}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>
              ))}

              {error && <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddCompany(false)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                  {submitting ? "Creating..." : "Create Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
