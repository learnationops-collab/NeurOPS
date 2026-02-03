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
import CloserDashboard from './pages/closer/dashboard/CloserDashboard';
import CloserLeadsPage from './pages/closer/leads/LeadsPage';
import CloserSettingsPage from './pages/closer/settings/SettingsPage';
import CloserNewSalePage from './pages/closer/records/NewSalePage';
import CloserNewAppointmentPage from './pages/closer/records/NewAppointmentPage';
import CloserKanbanPage from './pages/closer/kanban/CloserKanbanPage';
import SetterDashboard from './pages/setter/dashboard/DashboardPage';
import OperationsPage from './pages/admin/database/OperationsPage';
import BookingPage from './pages/public/BookingPage';
import StyleGuidePage from './pages/admin/utils/StyleGuidePage';
import './index.css';

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return null; // O un spinner de carga

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    // Redirigir a su dashboard correspondiente si intenta entrar a ruta ajena
    if (user.role === 'admin' || user.role === 'operator') return <Navigate to="/admin/dashboard" />;
    if (user.role === 'setter') return <Navigate to="/setter/dashboard" />;
    return <Navigate to="/closer/dashboard" />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/emergency-create" element={<EmergencyCreatePage />} />
          <Route path="/book/:username/:event_slug" element={<BookingPage />} />
          <Route path="/book/:event_slug" element={<BookingPage />} />


          {/* Protected Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute roles={['admin', 'operator']}>
                <MainLayout>
                  <AdminDashboard />
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
            path="/admin/database"
            element={
              <ProtectedRoute roles={['admin', 'operator']}>
                <MainLayout>
                  <DatabasePage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute roles={['admin', 'operator']}>
                <MainLayout>
                  <SettingsPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/operations"
            element={
              <ProtectedRoute roles={['admin', 'operator']}>
                <MainLayout>
                  <OperationsPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/style-guide"
            element={
              <ProtectedRoute roles={['admin', 'operator']}>
                <MainLayout>
                  <StyleGuidePage />
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
            path="/closer/embudo"
            element={
              <ProtectedRoute roles={['closer']}>
                <MainLayout>
                  <CloserKanbanPage />
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
            path="/setter/dashboard"
            element={
              <ProtectedRoute roles={['setter']}>
                <MainLayout>
                  <SetterDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
