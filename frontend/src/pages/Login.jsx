import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(getDashboardRoute(user.role));
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  function getDashboardRoute(role) {
    const routes = {
      platform_admin: "/admin/dashboard",
      firm_admin: "/firm/dashboard",
      company_admin: "/company/dashboard",
      company_user: "/company/dashboard",
      accountant: "/accountant/dashboard",
    };
    return routes[role] || "/dashboard";
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 flex-col justify-between p-10">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <span className="text-white font-bold text-sm">FB</span>
            </div>
            <span className="text-white font-bold text-lg">FinBridge</span>
          </div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            AI-powered financial document intelligence
          </h1>
          <p className="text-indigo-300 text-base leading-relaxed mb-10">
            Extract, validate, and trust-score your invoices automatically with multi-engine AI consensus.
          </p>
          <div className="space-y-4">
            {[
              "Multi-extractor AI consensus (Groq Vision + PyMuPDF + OCR)",
              "Field-level trust scoring with conflict detection",
              "Real-time GST validation and math verification",
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-indigo-200 text-sm leading-relaxed">{feature}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-indigo-600 text-xs">FinBridge © 2026 · Secure financial data exchange</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">FB</span>
            </div>
            <span className="font-bold text-slate-900">FinBridge</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm text-slate-900 placeholder-slate-400 transition-all"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm text-slate-900 placeholder-slate-400 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition-all duration-200 text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">Demo credentials</p>
            <div className="space-y-1.5 text-xs text-slate-400">
              <p><span className="text-slate-600 font-medium">Company Admin:</span> companyadmin@acme.com / companypass123</p>
              <p><span className="text-slate-600 font-medium">Accountant:</span> accountant@finbridge.com / firm123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
