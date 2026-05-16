import { useCallback, useState } from "react";
import Sidebar from "./Sidebar";
import InvoiceChat from "../ui/InvoiceChat";
import CommandPalette from "../ui/CommandPalette";
import OnboardingSplash from "../ui/OnboardingSplash";
import PWAInstallPrompt from "../ui/PWAInstallPrompt";
import { useAuth } from "../../context/AuthContext";
import { exportAuditReport } from "../../lib/auditExport";
import api from "../../lib/api";

export default function Layout({ children }) {
  const { user } = useAuth();

  const [showSplash, setShowSplash] = useState(() => {
    if (!user) return false;
    return !localStorage.getItem(`fb-onboarded-${user.id}`);
  });

  const handleExportAudit = useCallback(async () => {
    try {
      await exportAuditReport(api, user);
    } catch (e) {
      console.error("Audit export failed", e);
    }
  }, [user]);

  return (
    <>
      {showSplash && <OnboardingSplash onDone={() => setShowSplash(false)} />}
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <Sidebar />
        <main className="flex-1 lg:ml-64 min-h-screen overflow-auto">
          {children}
        </main>
        <InvoiceChat companyId={user?.company_id} />
        <CommandPalette onExportAudit={handleExportAudit} />
        <PWAInstallPrompt />
      </div>
    </>
  );
}
