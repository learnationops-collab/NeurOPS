import DatabasePage from '../../admin/database/DatabasePage';
import OperationsPage from '../../admin/database/OperationsPage';
import TeamManagementPage from '../../admin/team/TeamManagementPage';
import CloserAliasesPanel from '../../../components/operations/CloserAliasesPanel';
import BitacoraPanel from '../../../components/operations/BitacoraPanel';
import LeadsAuditTogglePanel from '../../../components/operations/LeadsAuditTogglePanel';
import ReportBacklogTogglePanel from '../../../components/operations/ReportBacklogTogglePanel';
import BugReportsPanel from '../../../components/operations/BugReportsPanel';
import PlaybookAdminPanel from '../../../components/operations/PlaybookAdminPanel';

/**
 * Las secciones del panel técnico de Operaciones, por id. Es la ÚNICA lista de lo que hay: el espacio de
 * Operaciones (`OperadorEspacioPage`) las reparte en pestañas. El panel antiguo, que el admin abría por URL,
 * se fue con «Administración» (10/10/2026).
 */
export const ETIQUETAS_TECNICAS = {
    team: 'Gestión de Equipo',
    closer_aliases: 'Alias de Closers',
    leads_audit: 'Auditoría de Leads',
    report_backlog: 'Bloqueo del Reporte',
    bug_reports: 'Reportes de Bugs',
    playbook: 'Playbook',
    bitacora: 'Bitácora de Cambios',
    database: 'Base de Datos',
    operations: 'Operaciones Críticas',
};

const SeccionTecnica = ({ id, embebido = false }) => {
    switch (id) {
        case 'team': return <TeamManagementPage embebido={embebido} />;
        case 'closer_aliases': return <CloserAliasesPanel />;
        case 'leads_audit': return <LeadsAuditTogglePanel />;
        case 'report_backlog': return <ReportBacklogTogglePanel />;
        case 'bug_reports': return <BugReportsPanel />;
        case 'playbook': return <PlaybookAdminPanel />;
        case 'bitacora': return <BitacoraPanel />;
        case 'database': return <DatabasePage />;
        // Antes también estaba como «Zona de peligro» (la misma pantalla dos veces) y había una pestaña
        // «Infraestructura» que solo decía «en construcción»: se fueron el 10/10/2026, junto con los UTMs, que
        // son de Marketing (el mismo generador está en /admin/marketing).
        case 'operations': return <OperationsPage />;
        default: return null;
    }
};

export default SeccionTecnica;
