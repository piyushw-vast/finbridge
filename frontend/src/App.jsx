import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import { ThemeProvider } from "./hooks/useTheme";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import Login from "./pages/Login";

import CompanyDashboard from "./pages/company/Dashboard";
import UploadInvoice from "./pages/company/UploadInvoice";
import InvoiceDetail from "./pages/company/InvoiceDetail";

import AccountantDashboard from "./pages/accountant/Dashboard";
import InvoiceReview from "./pages/accountant/InvoiceReview";

import FirmDashboard from "./pages/firm/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import Reports from "./pages/Reports";
import GSTDashboard from "./pages/GSTDashboard";

function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Company */}
          <Route path="/company/dashboard" element={
            <ProtectedRoute roles={["company_admin", "company_user"]}>
              <CompanyDashboard />
            </ProtectedRoute>
          } />
          <Route path="/company/upload" element={
            <ProtectedRoute roles={["company_admin", "company_user"]}>
              <UploadInvoice />
            </ProtectedRoute>
          } />
          <Route path="/company/invoice/:id" element={
            <ProtectedRoute roles={["company_admin", "company_user"]}>
              <InvoiceDetail />
            </ProtectedRoute>
          } />

          {/* Accountant */}
          <Route path="/accountant/dashboard" element={
            <ProtectedRoute roles={["accountant", "firm_admin"]}>
              <AccountantDashboard />
            </ProtectedRoute>
          } />
          <Route path="/accountant/review/:id" element={
            <ProtectedRoute roles={["accountant", "firm_admin"]}>
              <InvoiceReview />
            </ProtectedRoute>
          } />

          {/* Firm Admin */}
          <Route path="/firm/dashboard" element={
            <ProtectedRoute roles={["firm_admin"]}>
              <FirmDashboard />
            </ProtectedRoute>
          } />

          {/* Platform Admin */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute roles={["platform_admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Reports */}
          <Route path="/reports" element={
            <ProtectedRoute roles={["accountant", "firm_admin", "company_admin", "company_user"]}>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/reports/gst" element={
            <ProtectedRoute roles={["accountant", "firm_admin", "company_admin", "company_user"]}>
              <GSTDashboard />
            </ProtectedRoute>
          } />

          <Route path="/unauthorized" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <p className="text-4xl mb-3">🚫</p>
                <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
                <p className="text-gray-500 mt-1">You don't have permission to view this page.</p>
              </div>
            </div>
          } />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
