import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/MainLayout';
import AdminDashboard from './pages/admin/dashboard/AdminDashboard';
import FinancePage from './pages/admin/reports/FinancePage';
import FinancialAnalysisPage from './pages/admin/reports/FinancialAnalysisPage';
import PublicCallsBoardPage from './pages/public/PublicCallsBoardPage';
import SalesAttributionPage from './pages/admin/reports/SalesAttributionPage';
import LoginPage from './pages/auth/LoginPage';
import EmergencyCreatePage from './pages/auth/EmergencyCreatePage';
import AnalysisPage from './pages/admin/reports/AnalysisPage';
import ConstructionPage from './pages/common/ConstructionPage';
import DatabasePage from './pages/admin/database/DatabasePage';
import MarketingPage from './pages/admin/marketing/MarketingPage';
import SettingsPage from './pages/admin/settings/SettingsPage';
import AdminLeadsPage from './pages/admin/leads/LeadsPage';
import CloserDashboard from './pages/closer/dashboard/CloserDashboard';
import StatisticsPage from './pages/closer/dashboard/StatisticsPage';
import CloserLeadsPage from './pages/closer/leads/LeadsPage';
import CloserSettingsPage from './pages/closer/settings/SettingsPage';
import CloserNewSalePage from './pages/closer/records/NewSalePage';
import CloserNewAppointmentPage from './pages/closer/records/NewAppointmentPage';
import SalesAdminDashboard from './pages/sales_admin/dashboard/SalesAdminDashboard';
import TeamManagement from './pages/sales_admin/team/TeamManagement';
import SalesSettingsPage from './pages/sales_admin/settings/SalesSettingsPage';
import SalesAgendasPage from './pages/sales_admin/agendas/SalesAgendasPage';
import SetterDashboard from './pages/setter/dashboard/SetterDashboard';
import SetterStatisticsPage from './pages/setter/dashboard/StatisticsPage';
import SetterAgendasPage from './pages/setter/agendas/SetterAgendasPage';
import OperationsPage from './pages/admin/database/OperationsPage';
import OperationsDashboard from './pages/operations/dashboard/OperationsDashboard';
import OperationsSettingsPage from './pages/operations/settings/OperationsSettingsPage';
import BookingPage from './pages/public/BookingPage';
import BackupPage from './pages/public/BackupPage';
import RestorePage from './pages/public/RestorePage';
import PublicSetterReportPage from './pages/public/PublicSetterReportPage';
import PublicSetterStatsPage from './pages/public/PublicSetterStatsPage';
import PublicCloserReportPage from './pages/public/PublicCloserReportPage';
import PublicCloserStatsPage from './pages/public/PublicCloserStatsPage';
import PublicTriageReportPage from './pages/public/PublicTriageReportPage';
import PublicTriageStatsPage from './pages/public/PublicTriageStatsPage';
import PublicHubPage from './pages/public/PublicHubPage';
import AdManagementPage from './pages/public/AdManagementPage';
import PublicSalesAttributionPage from './pages/public/PublicSalesAttributionPage';
import PixelTracker from './components/common/PixelTracker';

import AdminSalesHubPage from './pages/admin/reports/AdminSalesHubPage';
import AdminMarketingHubPage from './pages/admin/marketing/AdminMarketingHubPage';
import AdminSheetsHubPage from './pages/admin/reports/AdminSheetsHubPage';

import StyleGuidePage from './pages/admin/utils/StyleGuidePage';
import TeamManagementPage from './pages/admin/team/TeamManagementPage';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import './index.css';

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return null; // O un spinner de carga

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    // Redirigir a su dashboard correspondiente si intenta entrar a ruta ajena
    if (user.role === 'admin') return <Navigate to="/admin/ventas" />;
    if (user.role === 'operator') return <Navigate to="/ops/dashboard" />;
    if (user.role === 'setter') return <Navigate to="/setter/report" />;
    if (user.role === 'closer') return <Navigate to="/closer/report" />;
    if (user.role === 'triage') return <Navigate to="/triage/report" />;
    return <Navigate to="/" />;
  }

  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <PixelTracker />
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/emergency-create" element={<EmergencyCreatePage />} />
            <Route path="/book/:setter_id/:event_slug" element={<BookingPage />} />
            <Route path="/book/:event_slug" element={<BookingPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/restore" element={<RestorePage />} />

            {/* Protected Admin Routes: Hubs */}
            <Route
              path="/ops/dashboard"
              element={
                <ProtectedRoute roles={['operator', 'admin']}>
                  <MainLayout>
                    <OperationsSettingsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ventas"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <AdminSalesHubPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/marketing"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <AdminMarketingHubPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sheets"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <AdminSheetsHubPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            {/* Protected Role-Specific Routes */}
            <Route
              path="/setter/report"
              element={
                <ProtectedRoute roles={['setter']}>
                  <MainLayout>
                    <PublicSetterReportPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/report"
              element={
                <ProtectedRoute roles={['closer']}>
                  <MainLayout>
                    <PublicCloserReportPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/triage/report"
              element={
                <ProtectedRoute roles={['triage']}>
                  <MainLayout>
                    <PublicTriageReportPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            {/* Hub Público Remanente */}
            <Route path="/publico" element={<PublicHubPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
