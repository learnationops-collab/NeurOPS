import { Shield } from 'lucide-react';
import DatabasePage from '../../admin/database/DatabasePage';
import OperationsPage from '../../admin/database/OperationsPage';
import TeamManagementPage from '../../admin/team/TeamManagementPage';
import UTMGenerator from '../../../components/operations/UTMGenerator';
import CloserAliasesPanel from '../../../components/operations/CloserAliasesPanel';
import BitacoraPanel from '../../../components/operations/BitacoraPanel';
import LeadsAuditTogglePanel from '../../../components/operations/LeadsAuditTogglePanel';
import ReportBacklogTogglePanel from '../../../components/operations/ReportBacklogTogglePanel';
import BugReportsPanel from '../../../components/operations/BugReportsPanel';
import PlaybookAdminPanel from '../../../components/operations/PlaybookAdminPanel';
import Card from '../../../components/ui/Card';

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
    marketing: 'Marketing UTMs',
    database: 'Base de Datos',
    operations: 'Operaciones Críticas',
    infra: 'Infraestructura',
    danger_zone: 'Zona de Peligro',
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
        case 'marketing': return <UTMGenerator />;
        case 'database': return <DatabasePage />;
        // «Operaciones críticas» y «Zona de peligro» son la misma pantalla, con su advertencia.
        case 'operations':
        case 'danger_zone': return <OperationsPage />;
        case 'infra':
            return (
                <Card variant="surface" className="p-10 space-y-6 bg-amber-500/5 border-amber-500/10">
                    <div className="flex items-center gap-4 text-amber-500">
                        <Shield size={32} />
                        <h3 className="text-xl font-black italic tracking-tighter uppercase">Monitor de Infraestructura</h3>
                    </div>
                    <p className="text-sm text-muted font-medium leading-relaxed">
                        Estas configuraciones permiten gestionar el despliegue y los límites de recursos del servidor. ( Bajo Construcción )
                    </p>
                </Card>
            );
        default: return null;
    }
};

export default SeccionTecnica;
