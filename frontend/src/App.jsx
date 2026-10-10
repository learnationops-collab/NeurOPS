import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AparienciaProvider } from './context/AparienciaContext';
import { ConfiguracionProvider } from './sesion/ConfiguracionContext';
import { PortalProvider, PortalRuta } from './sesion/PortalContext';
import { roleLandingPath } from './utils/roleLanding';
import MainLayout from './components/MainLayout';
import AdminDashboard from './pages/admin/dashboard/AdminDashboard';
import FinancialAnalysisPage from './pages/admin/reports/FinancialAnalysisPage';
import PublicCallsBoardPage from './pages/public/PublicCallsBoardPage';
import SalesAttributionPage from './pages/admin/reports/SalesAttributionPage';
import LoginPage from './pages/auth/LoginPage';
import CortexPage from './pages/auth/CortexPage';
import SessionEntry from './pages/auth/SessionEntry';
import AnalysisPage from './pages/admin/reports/AnalysisPage';
import ConstructionPage from './pages/common/ConstructionPage';
import DatabasePage from './pages/admin/database/DatabasePage';
import MarketingPage from './pages/admin/marketing/MarketingPage';
import AdminLeadsPage from './pages/admin/leads/LeadsPage';
import CloserDashboard from './pages/closer/dashboard/CloserDashboard';
import StatisticsPage from './pages/closer/dashboard/StatisticsPage';
import CloserLeadsPage from './pages/closer/leads/LeadsPage';
import CloserNewAppointmentPage from './pages/closer/records/NewAppointmentPage';
import SetterStatisticsPage from './pages/setter/dashboard/StatisticsPage';
import LeadsManagementPage from './pages/shared/LeadsManagementPage';
import SetterEspacioPage from './pages/setter/SetterEspacioPage';
import CloserWorkflowPage from './pages/closer/CloserWorkflowPage';
import OperationsPage from './pages/admin/database/OperationsPage';
import OpsRuta from './pages/operations/OpsRuta';
import BookingPage from './pages/public/BookingPage';
import PublicCloserReportPage from './pages/public/PublicCloserReportPage';
import PublicCloserStatsPage from './pages/public/PublicCloserStatsPage';
import PublicTriageReportPage from './pages/public/PublicTriageReportPage';
import AdManagementPage from './pages/public/AdManagementPage';
import FinancialAgendasPage from './pages/admin/reports/FinancialAgendasPage';
import TriageWorkflowPage from './pages/triage/TriageWorkflowPage';
import PublicSalesAttributionPage from './pages/public/PublicSalesAttributionPage';
import PublicWorkshopStatsPage from './pages/public/PublicWorkshopStatsPage';
import PixelTracker from './components/common/PixelTracker';
import BugReportWidget from './components/feedback/BugReportWidget';
import { PlaybookProvider } from './contexts/PlaybookContext';
import PlaybookOverlay from './components/playbook/PlaybookOverlay';
import PlaybookNotification from './components/playbook/PlaybookNotification';
import PrivacyPolicyPage from './pages/public/PrivacyPolicyPage';
import TermsOfServicePage from './pages/public/TermsOfServicePage';
import AgendasV2Routes from './pages/agendas_v2/AgendasV2Routes';
import AgendasV2Publica from './pages/agendas_v2/AgendasV2Publica';
import UnattributedLeadsPage from './pages/admin/marketing/UnattributedLeadsPage';
import FormsManagementPage from './pages/shared/FormsManagementPage';

import AdminSalesHubPage from './pages/admin/reports/AdminSalesHubPage';
import AdminMarketingHubPage from './pages/admin/marketing/AdminMarketingHubPage';
import AdminSheetsHubPage from './pages/admin/reports/AdminSheetsHubPage';
import WorkshopDashboardPage from './pages/admin/workshop/WorkshopDashboardPage';
import HiringDashboardPage from './pages/admin/hiring/HiringDashboardPage';


import DashboardComercial from './pages/comercial/DashboardComercial';
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
    // (mapa único en utils/roleLanding.js, el mismo que usa el login).
    return <Navigate to={roleLandingPath(user.role)} />;
  }

  return children;
};

// Páginas que ve un lead o cualquiera sin cuenta: ni el widget de bugs ni los avisos del Playbook,
// aunque quien las abra tenga la sesión del equipo iniciada.
const RUTAS_PUBLICAS = ['/agendas-v2/agenda', '/book/', '/politica-de-privacidad', '/privacy-policy', '/terminos-de-servicio', '/terms-of-service'];
const esRutaPublica = (pathname) => RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(r.endsWith('/') ? r : r + '/'));

function SoloInterno({ children }) {
  const { pathname } = useLocation();
  return esRutaPublica(pathname) ? null : children;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AparienciaProvider>
        <PlaybookProvider>
        <Router>
        <ConfiguracionProvider>
        <PortalProvider>
          <PixelTracker />
          <Toaster position="top-right" />
          <SoloInterno>
            <BugReportWidget />
            <PlaybookOverlay />
            <PlaybookNotification />
          </SoloInterno>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/session-entry" element={<SessionEntry />} />
            {/* El Portal (10/10/2026) es una pantalla encima de lo que se ve, no una ruta
                (sesion/PortalContext.jsx): /portal, /inicio y /vistas quedan por los links guardados. */}
            <Route path="/portal" element={<ProtectedRoute><PortalRuta /></ProtectedRoute>} />
            {/* Cortex (10/10/2026): el área de todos, con Learnito y el Playbook. */}
            <Route path="/cortex" element={<ProtectedRoute><CortexPage /></ProtectedRoute>} />
            <Route path="/inicio" element={<Navigate to="/portal?elegir=1" replace />} />
            <Route path="/vistas" element={<Navigate to="/portal?elegir=1" replace />} />
            <Route path="/book/:setter_id/:event_slug" element={<BookingPage />} />
            <Route path="/book/:event_slug" element={<BookingPage />} />
            <Route path="/politica-de-privacidad" element={<PrivacyPolicyPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terminos-de-servicio" element={<TermsOfServicePage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
            {/* Agendas 2.0: la página de reserva del lead es pública; Thalamus (la gestión) pide sesión
                de la dirección comercial. Van en rutas y módulos separados para que la página pública
                no cargue la herramienta de gestión ni sus llamadas a la API. */}
            <Route path="/agendas-v2/agenda/*" element={<AgendasV2Publica />} />
            <Route
              path="/agendas-v2/*"
              element={
                <ProtectedRoute roles={['admin', 'director_comercial']}>
                  <AgendasV2Routes />
                </ProtectedRoute>
              }
            />

            {/* Operaciones: un solo espacio con su dock (ver OpsRuta). Desde el 10/10/2026 el admin
                entra al mismo que el operador: «Administración» se retiró y lo suyo pasó acá. Las
                rutas viejas llevan a su sección. */}
            <Route
              path="/ops/dashboard"
              element={
                <ProtectedRoute roles={['operator', 'admin']}>
                  <OpsRuta />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ops/agendas"
              element={
                <ProtectedRoute roles={['operator', 'admin']}>
                  <OpsRuta paso="agendas" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ops/ventas"
              element={
                <ProtectedRoute roles={['operator', 'admin']}>
                  <OpsRuta paso="ventas" />
                </ProtectedRoute>
              }
            />
            {/* Dashboard comercial. La MISMA pantalla para tres audiencias: la direccion
                comercial la ve completa (todo el equipo, switch Closers/Setters y Reportar) y
                closers y setters la ven como "Mis datos", acotada a ellos. Quien ve que lo
                decide el backend a partir de la sesion (ver app/api/comercial.py), no la ruta:
                estas solo cambian donde vive la pantalla dentro de cada dock. El setter la ve
                embebida en su espacio (/setter/deck?step=datos); su ruta vieja redirige ahi.

                SIN MainLayout, como /closer/deck y /admin/hiring: la pantalla trae su propio
                dock fijo abajo y el de la app le quedaba encima, superpuesto pixel a pixel. La
                salida (volver al mazo, o volver a tu sesion si es una simulacion) la ofrece la
                propia pantalla en su header. */}
            <Route
              path="/admin/comercial"
              element={
                <ProtectedRoute roles={['admin', 'director_comercial']}>
                  <DashboardComercial />
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/mis-datos"
              element={
                <ProtectedRoute roles={['closer']}>
                  <DashboardComercial />
                </ProtectedRoute>
              }
            />
            <Route path="/setter/mis-datos" element={<Navigate replace to="/setter/deck?step=datos" />} />
            <Route
              path="/admin/ventas"
              element={
                <ProtectedRoute roles={['admin', 'director_comercial']}>
                  <MainLayout>
                    <AdminSalesHubPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            {/* /finanzas: el mismo tablero con solo Finanzas y Payroll en el dock, la vista Finances
                (08/10/2026), aparte del dashboard de la dirección comercial, que ya no las trae.
                SIN MainLayout, como /admin/comercial. Los links viejos (/admin/finance, /admin/payroll
                y /admin/comercial?s=finanzas o payroll) llevan acá; sin el permiso «ver finanzas»
                la pantalla lo avisa. */}
            <Route
              path="/finanzas"
              element={
                <ProtectedRoute roles={['admin', 'director_comercial']}>
                  <DashboardComercial espacio="finanzas" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finance"
              element={<Navigate to="/finanzas?s=finanzas" replace />}
            />
            <Route
              path="/admin/payroll"
              element={<Navigate to="/finanzas?s=payroll" replace />}
            />
            <Route
              path="/admin/marketing"
              element={
                <ProtectedRoute roles={['admin', 'director_marketing']}>
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
            {/* Formularios es una sección de Operaciones desde el 10/10/2026. */}
            <Route path="/admin/formularios" element={<Navigate to="/ops/dashboard?step=formularios" replace />} />
            <Route
              path="/admin/workshops"
              element={
                <ProtectedRoute roles={['admin', 'director_marketing']}>
                  <MainLayout>
                    <WorkshopDashboardPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            {/* Respaldo y restauración de la base: desde el 10/10/2026 son pestañas de Operaciones › Datos
                (admin u operador; el servidor lo vuelve a exigir, además de la clave BACKUP_SECRET_KEY que
                escribe la persona en la pantalla). Antes eran páginas sueltas del admin, sin enlace. */}
            <Route path="/admin/backup" element={<Navigate to="/ops/dashboard?step=datos&tab=respaldo" replace />} />
            <Route path="/admin/restore" element={<Navigate to="/ops/dashboard?step=datos&tab=restaurar" replace />} />
            <Route
              path="/ops/course-editor"
              element={
                <ProtectedRoute roles={['operator', 'admin']}>
                  <OpsRuta paso="curso" />
                </ProtectedRoute>
              }
            />
            {/* Postulaciones (la búsqueda de Closer de ventas) es desde el 10/10/2026 la sección
                Closers de Learnation Talent: se retiró la vista «Administración». Los links viejos
                llevan ahí. */}
            <Route path="/admin/postulaciones" element={<Navigate replace to="/admin/hiring?s=closers" />} />
            <Route
              path="/admin/hiring"
              element={
                // Learnation Talent: sub-app con header y dock propios, sin MainLayout.
                // Es la única pantalla del rol `hiring` (Asistente y, desde el 10/10/2026,
                // la sección Closers, que eran las Postulaciones del admin).
                <ProtectedRoute roles={['admin', 'hiring']}>
                  <HiringDashboardPage />
                </ProtectedRoute>
              }
            />


            {/* Protected Role-Specific Routes */}
            {/* El espacio del setter: el mazo, las agendas, el reporte y sus datos en UNA pantalla
                con un solo dock (ver SetterEspacioPage). Sin MainLayout, como el mazo del
                closer: el dock de la app quedaba encima del propio. Antes eran cinco paginas y
                "Mis datos" traia otro dock, asi que al entrar a los datos se perdia la vuelta
                al trabajo. Las rutas viejas redirigen a su seccion para no romper links. */}
            <Route
              path="/setter/deck"
              element={
                <ProtectedRoute roles={['setter']}>
                  <SetterEspacioPage />
                </ProtectedRoute>
              }
            />
            <Route path="/setter/dashboard" element={<Navigate replace to="/setter/deck?step=datos" />} />
            <Route path="/setter/report" element={<Navigate replace to="/setter/deck?step=reporte" />} />
            <Route path="/setter/statistics" element={<Navigate replace to="/setter/deck?step=reporte&tab=historial" />} />
            <Route path="/setter/agendas" element={<Navigate replace to="/setter/deck?step=agendas" />} />
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
                <ProtectedRoute roles={['admin']}>
                  <MainLayout>
                    <PublicCloserStatsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/dashboard"
              element={
                <ProtectedRoute roles={['closer', 'admin']}>
                  <MainLayout>
                    <CloserDashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/closer/deck"
              element={
                <ProtectedRoute roles={['closer']}>
                  <CloserWorkflowPage />
                </ProtectedRoute>
              }
            />
            {/* La venta se declara en la ficha del cliente, con el mismo recorrido que la venta de
                una llamada: el mazo abre el buscador para elegir a quién. */}
            <Route path="/closer/sales/new" element={<Navigate replace to="/closer/deck?venta=1" />} />
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
              path="/triage/deck"
              element={
                <ProtectedRoute roles={['triage']}>
                  <MainLayout>
                    <TriageWorkflowPage />
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
        </PortalProvider>
        </ConfiguracionProvider>
        </Router>
        </PlaybookProvider>
        </AparienciaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
