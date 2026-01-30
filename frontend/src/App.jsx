import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/MainLayout';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import EmergencyCreatePage from './pages/EmergencyCreatePage';
import AnalysisPage from './pages/AnalysisPage';
import DatabasePage from './pages/DatabasePage';
import SettingsPage from './pages/SettingsPage';
import CloserDashboard from './pages/CloserDashboard';
import CloserLeadsPage from './pages/CloserLeadsPage';
import CloserSettingsPage from './pages/CloserSettingsPage';
import CloserNewSalePage from './pages/CloserNewSalePage';
import CloserNewAppointmentPage from './pages/CloserNewAppointmentPage';
import SetterDashboard from './pages/SetterDashboard';
import OperationsPage from './pages/OperationsPage';
import BookingPage from './pages/BookingPage';
import StyleGuidePage from './pages/StyleGuidePage';
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
            path="/admin/analysis/finance"
            element={
              <ProtectedRoute roles={['admin', 'operator']}>
                <MainLayout>
                  <AnalysisPage defaultTab="finance" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analysis/closers"
            element={
              <ProtectedRoute roles={['admin', 'operator']}>
                <MainLayout>
                  <AnalysisPage defaultTab="closers" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analysis/setters"
            element={
              <ProtectedRoute roles={['admin', 'operator']}>
                <MainLayout>
                  <AnalysisPage defaultTab="setters" />
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
