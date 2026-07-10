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
import SetterDashboard from './pages/setter/dashboard/SetterDashboard';
import SetterStatisticsPage from './pages/setter/dashboard/StatisticsPage';
import SetterAgendasPage from './pages/setter/agendas/SetterAgendasPage';
import LeadsManagementPage from './pages/shared/LeadsManagementPage';
import SetterWorkflowPage from './pages/setter/SetterWorkflowPage';
import CloserWorkflowPage from './pages/closer/CloserWorkflowPage';
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
import AdManagementPage from './pages/public/AdManagementPage';
import FinancialAgendasPage from './pages/admin/reports/FinancialAgendasPage';
import PublicSalesAttributionPage from './pages/public/PublicSalesAttributionPage';
import PublicWorkshopStatsPage from './pages/public/PublicWorkshopStatsPage';
import PixelTracker from './components/common/PixelTracker';
import UnattributedLeadsPage from './pages/admin/marketing/UnattributedLeadsPage';
import AlertsHubPage from './pages/admin/alerts/AlertsHubPage';
import FormsManagementPage from './pages/shared/FormsManagementPage';

import AdminSalesHubPage from './pages/admin/reports/AdminSalesHubPage';
import AdminMarketingHubPage from './pages/admin/marketing/AdminMarketingHubPage';
import AdminSheetsHubPage from './pages/admin/reports/AdminSheetsHubPage';
import AdminPayrollPage from './pages/admin/reports/AdminPayrollPage';

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
    if (user.role === 'setter') return <Navigate to="/setter/statistics" />;
    if (user.role === 'closer') return <Navigate to="/closer/deck?step=agendas" />;
    if (user.role === 'triage') return <Navigate to="/triage/agendas" />;
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
              path="/admin/finance"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <FinancePage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/payroll"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <AdminPayrollPage />
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
            <Route
              path="/admin/alerts"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <AlertsHubPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/formularios"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <FormsManagementPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            {/* Protected Role-Specific Routes */}
            <Route
              path="/setter/dashboard"
              element={
                <ProtectedRoute roles={['setter']}>
                  <MainLayout>
                    <SetterDashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/setter/statistics"
              element={
                <ProtectedRoute roles={['setter']}>
                  <MainLayout>
                    <PublicSetterStatsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
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
              path="/setter/deck"
              element={
                <ProtectedRoute roles={['setter']}>
                  <MainLayout>
                    <SetterWorkflowPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/report"
              element={
                <ProtectedRoute roles={['closer', 'admin']}>
                  <MainLayout>
                    <PublicCloserReportPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/stats"
              element={
                <ProtectedRoute roles={['closer']}>
                  <MainLayout>
                    <PublicCloserStatsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/deck"
              element={
                <ProtectedRoute roles={['closer']}>
                  <MainLayout>
                    <CloserWorkflowPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/sales/new"
              element={
                <ProtectedRoute roles={['closer']}>
                  <MainLayout>
                    <CloserNewSalePage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/appointments/new"
              element={
                <ProtectedRoute roles={['closer']}>
                  <MainLayout>
                    <CloserNewAppointmentPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/triage/agendas"
              element={
                <ProtectedRoute roles={['triage']}>
                  <MainLayout>
                    <FinancialAgendasPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/triage/formularios"
              element={
                <ProtectedRoute roles={['triage']}>
                  <MainLayout>
                    <FormsManagementPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/triage/report"
              element={
                <ProtectedRoute roles={['triage', 'admin']}>
                  <MainLayout>
                    <PublicTriageReportPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/workshop"
              element={
                <ProtectedRoute roles={['admin', 'marketer']}>
                  <MainLayout>
                    <PublicWorkshopStatsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/unattributed-leads"
              element={
                <ProtectedRoute roles={['admin', 'setter', 'closer']}>
                  <MainLayout>
                    <UnattributedLeadsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />



            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
