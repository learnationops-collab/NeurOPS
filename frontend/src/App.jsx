import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/MainLayout';
import AdminDashboard from './pages/admin/dashboard/AdminDashboard';
import FinancePage from './pages/admin/reports/FinancePage';
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
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" />;
    if (user.role === 'operator') return <Navigate to="/ops/dashboard" />;
    if (user.role === 'setter') return <Navigate to="/setter/agendas" />;
    if (user.role === 'sales_admin') return <Navigate to="/sales-admin/dashboard" />;
    return <Navigate to="/closer/dashboard" />;
  }

  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/emergency-create" element={<EmergencyCreatePage />} />
            {/* Unified Booking Route (Slug handles both general and personal) */}
            <Route path="/book/:setter_id/:event_slug" element={<BookingPage />} />
            <Route path="/book/:event_slug" element={<BookingPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/restore" element={<RestorePage />} />
            <Route path="/reporte-setter" element={<PublicSetterReportPage />} />
            <Route path="/estadisticas-setters" element={<PublicSetterStatsPage />} />


            {/* Protected Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <AdminDashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/leads"
              element={
                <ProtectedRoute roles={['admin', 'operator']}>
                  <MainLayout>
                    <AdminLeadsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finance"
              element={
                <ProtectedRoute roles={['admin', 'operator']}>
                  <MainLayout>
                    <FinancePage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/marketing"
              element={
                <ProtectedRoute roles={['admin', 'operator']}>
                  <MainLayout>
                    <MarketingPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sales"
              element={
                <ProtectedRoute roles={['admin', 'operator']}>
                  <MainLayout>
                    <AnalysisPage defaultTab="closers" />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/fulfillment"
              element={
                <ProtectedRoute roles={['admin', 'operator']}>
                  <MainLayout>
                    <ConstructionPage title="Fulfillment" />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/team"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <TeamManagementPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/style-guide"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <StyleGuidePage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <SettingsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            {/* Protected Closer Routes */}
            <Route
              path="/closer/dashboard"
              element={
                <ProtectedRoute roles={['closer']}>
                  <MainLayout>
                    <CloserDashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/stats"
              element={
                <ProtectedRoute roles={['closer']}>
                  <MainLayout>
                    <StatisticsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/settings"
              element={
                <ProtectedRoute roles={['closer']}>
                  <MainLayout>
                    <CloserSettingsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/leads"
              element={
                <ProtectedRoute roles={['closer']}>
                  <MainLayout>
                    <CloserLeadsPage />
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

            {/* Protected Setter Routes */}
            <Route
              path="/setter/agendas"
              element={
                <ProtectedRoute roles={['setter']}>
                  <MainLayout>
                    <SetterAgendasPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
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
              path="/setter/stats"
              element={
                <ProtectedRoute roles={['setter']}>
                  <MainLayout>
                    <SetterStatisticsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            {/* Protected Operations Routes */}
            <Route
              path="/ops/dashboard"
              element={
                <ProtectedRoute roles={['operator']}>
                  <MainLayout>
                    <OperationsDashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ops/database"
              element={
                <ProtectedRoute roles={['operator']}>
                  <MainLayout>
                    <DatabasePage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ops/settings"
              element={
                <ProtectedRoute roles={['operator']}>
                  <MainLayout>
                    <OperationsSettingsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            {/* Protected Sales Admin Routes */}
            <Route
              path="/sales-admin/dashboard"
              element={
                <ProtectedRoute roles={['sales_admin']}>
                  <MainLayout>
                    <SalesAdminDashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales-admin/agendas"
              element={
                <ProtectedRoute roles={['sales_admin']}>
                  <MainLayout>
                    <SalesAgendasPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales-admin/team"
              element={
                <ProtectedRoute roles={['sales_admin']}>
                  <MainLayout>
                    <TeamManagementPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales-admin/settings"
              element={
                <ProtectedRoute roles={['sales_admin']}>
                  <MainLayout>
                    <SalesSettingsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
