import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

const ROLE_LABELS = {
  platform_admin: "Platform Admin",
  firm_admin: "Firm Admin",
  company_admin: "Company Admin",
  company_user: "Company User",
  accountant: "Accountant",
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.get("/notifications/unread-count")
      .then(r => setUnreadCount(r.data.count))
      .catch(() => {});
    const interval = setInterval(() => {
      api.get("/notifications/unread-count")
        .then(r => setUnreadCount(r.data.count))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">F</span>
        </div>
        <span className="text-lg font-bold text-gray-900 dark:text-white">FinBridge</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/notifications")}
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-700 font-semibold text-sm">
              {user?.full_name?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.full_name}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[user?.role]}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
