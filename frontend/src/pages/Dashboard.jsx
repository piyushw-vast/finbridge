import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const roleLabels = {
  platform_admin: "Platform Admin",
  firm_admin: "Firm Admin",
  company_admin: "Company Admin",
  company_user: "Company User",
  accountant: "Accountant",
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="font-semibold text-gray-900">FinBridge</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
            <p className="text-xs text-blue-600">{roleLabels[user?.role]}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome, {user?.full_name}
        </h1>
        <p className="text-gray-500 mb-8">
          You're signed in as <span className="font-medium text-blue-600">{roleLabels[user?.role]}</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">Role</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{roleLabels[user?.role]}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">Email</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{user?.email}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">Status</p>
            <p className="text-xl font-semibold text-green-600 mt-1">Active</p>
          </div>
        </div>
      </main>
    </div>
  );
}
