import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import OperationsPage from './pages/OperationsPage';
import BookingPage from './pages/BookingPage';
import StyleGuidePage from './pages/StyleGuidePage';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/emergency-create" element={<EmergencyCreatePage />} />
        <Route path="/book/:username/:event_slug" element={<BookingPage />} />


        {/* Protected Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <MainLayout>
              <AdminDashboard />
            </MainLayout>
          }
        />
        <Route
          path="/admin/analysis"
          element={
            <MainLayout>
              <AnalysisPage />
            </MainLayout>
          }
        />
        <Route
          path="/admin/database"
          element={
            <MainLayout>
              <DatabasePage />
            </MainLayout>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <MainLayout>
              <SettingsPage />
            </MainLayout>
          }
        />
        <Route
          path="/admin/operations"
          element={
            <MainLayout>
              <OperationsPage />
            </MainLayout>
          }
        />
        <Route
          path="/admin/style-guide"
          element={
            <MainLayout>
              <StyleGuidePage />
            </MainLayout>
          }
        />

        {/* Protected Closer Routes */}
        <Route
          path="/closer/dashboard"
          element={
            <MainLayout>
              <CloserDashboard />
            </MainLayout>
          }
        />
        <Route
          path="/closer/leads"
          element={
            <MainLayout>
              <CloserLeadsPage />
            </MainLayout>
          }
        />
        <Route
          path="/closer/settings"
          element={
            <MainLayout>
              <CloserSettingsPage />
            </MainLayout>
          }
        />
        <Route
          path="/closer/sales/new"
          element={
            <MainLayout>
              <CloserNewSalePage />
            </MainLayout>
          }
        />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
