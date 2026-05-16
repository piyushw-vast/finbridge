import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import { useTheme } from "../../hooks/useTheme";
import api from "../../lib/api";

const ROLE_LABELS = {
  platform_admin: "Platform Admin",
  firm_admin: "Firm Admin",
  company_admin: "Company Admin",
  company_user: "Company User",
  accountant: "Accountant",
};

function getNavItems(role) {
  const items = [];
  if (role === "company_admin" || role === "company_user") {
    items.push({ label: "Dashboard", path: "/company/dashboard", icon: "home" });
    items.push({ label: "Upload Invoice", path: "/company/upload", icon: "upload" });
  }
  if (role === "accountant") {
    items.push({ label: "Review Queue", path: "/accountant/dashboard", icon: "review" });
  }
  if (role === "firm_admin") {
    items.push({ label: "Review Queue", path: "/accountant/dashboard", icon: "review" });
    items.push({ label: "Firm Overview", path: "/firm/dashboard", icon: "firm" });
  }
  if (role === "platform_admin") {
    items.push({ label: "Admin", path: "/admin/dashboard", icon: "admin" });
  }
  if (role !== "platform_admin") {
    items.push({ label: "Reports", path: "/reports", icon: "reports" });
    items.push({ label: "GST Dashboard", path: "/reports/gst", icon: "reports" });
  }
  return items;
}

function Icon({ name, className = "w-5 h-5" }) {
  const icons = {
    home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    upload: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
    review: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    firm: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    reports: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    admin: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  };
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={icons[name]} />
    </svg>
  );
}

const NOTIF_ICONS = {
  invoice_accepted: { bg: "bg-emerald-100", color: "text-emerald-600", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  invoice_rejected: { bg: "bg-rose-100", color: "text-rose-500", icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" },
  invoice_needs_review: { bg: "bg-amber-100", color: "text-amber-600", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  report_published: { bg: "bg-indigo-100", color: "text-indigo-600", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" },
  general: { bg: "bg-slate-100", color: "text-slate-500", icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationsPanel({ onClose, onRead }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const panelRef = useRef(null);

  useEffect(() => {
    api.get("/notifications?limit=15")
      .then(r => setNotifications(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));

    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAllRead() {
    await api.post("/notifications/read-all").catch(console.error);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    onRead(0);
  }

  async function handleClick(notif) {
    if (!notif.is_read) {
      await api.post(`/notifications/${notif.id}/read`).catch(console.error);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      onRead(prev => Math.max(0, prev - 1));
    }
    if (notif.entity_type === "invoice" && notif.entity_id) {
      navigate(`/company/invoice/${notif.entity_id}`);
      onClose();
    }
  }

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div
      ref={panelRef}
      className="absolute left-full ml-2 bottom-0 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden"
      style={{ maxHeight: "480px" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            Mark all read
          </button>
        )}
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="shimmer h-12 rounded-xl" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-xs text-slate-400">No notifications yet</p>
          </div>
        ) : (
          notifications.map(notif => {
            const cfg = NOTIF_ICONS[notif.type] || NOTIF_ICONS.general;
            return (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0 ${!notif.is_read ? "bg-indigo-50/50" : ""}`}
              >
                <div className={`w-8 h-8 ${cfg.bg} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <svg className={`w-4 h-4 ${cfg.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs font-semibold leading-snug ${notif.is_read ? "text-slate-600" : "text-slate-900"}`}>{notif.title}</p>
                    {!notif.is_read && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0 mt-1" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-slate-300 mt-1">{timeAgo(notif.created_at)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { user, company, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { dark, toggle: toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [bellPulse, setBellPulse] = useState(false);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const fetchCount = () => {
      api.get("/notifications/unread-count").then(r => {
        const newCount = r.data.count;
        if (newCount > prevCountRef.current) {
          setBellPulse(true);
          setTimeout(() => setBellPulse(false), 3000);
        }
        prevCountRef.current = newCount;
        setUnreadCount(newCount);
      }).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!["accountant", "firm_admin"].includes(user?.role)) return;
    api.get("/invoices/stats/summary")
      .then(r => setPendingCount((r.data.under_review ?? 0) + (r.data.needs_correction ?? 0)))
      .catch(() => {});
  }, [user?.role]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const navItems = getNavItems(user?.role);

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 flex flex-col z-40 hidden lg:flex">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-sm tracking-tight">FB</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-base leading-none truncate">
              {company?.name ? company.name.split(" ").slice(0, 2).join(" ") : "FinBridge"}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">Financial Intelligence</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-slate-600 text-xs font-semibold uppercase tracking-widest px-3 mb-3">Menu</p>
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left
                ${isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
            >
              <Icon name={item.icon} className="w-4.5 h-4.5 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.label === "Review Queue" && pendingCount > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Cmd+K hint */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2">
          <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs text-slate-500 flex-1">Search everything…</span>
          <div className="flex items-center gap-0.5">
            <kbd className="text-[9px] bg-slate-700 text-slate-400 px-1 py-0.5 rounded font-mono border border-slate-600">⌘</kbd>
            <kbd className="text-[9px] bg-slate-700 text-slate-400 px-1 py-0.5 rounded font-mono border border-slate-600">K</kbd>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-1">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(v => !v)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${showNotifs ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
          >
            <div className="relative">
              <Icon name="bell" className={`w-4.5 h-4.5 transition-transform ${bellPulse ? "animate-bounce" : ""}`} />
              {bellPulse && (
                <span className="absolute inset-0 rounded-full bg-rose-400 opacity-40 animate-ping" />
              )}
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-rose-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <span className="font-medium">Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-auto bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                {unreadCount}
              </span>
            )}
          </button>
          {showNotifs && (
            <NotificationsPanel
              onClose={() => setShowNotifs(false)}
              onRead={setUnreadCount}
            />
          )}
        </div>

        {/* User */}
        <div className="px-3 py-2.5 rounded-xl bg-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-semibold">
              {user?.full_name?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-slate-500 text-xs truncate">{ROLE_LABELS[user?.role]}</p>
          </div>
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-800 hover:text-white transition-all duration-150"
        >
          {dark ? (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
          <span className="font-medium">{dark ? "Light mode" : "Dark mode"}</span>
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-rose-900/30 hover:text-rose-400 transition-all duration-150"
        >
          <Icon name="logout" className="w-4.5 h-4.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
