import { useState } from 'react';
import {
    Database,
    AlertTriangle,
    HardDrive,
    Activity,
    Users,
    Share2,
    UserCheck,
    History,
    ClipboardList,
    ShieldAlert,
    Bug,
    GraduationCap
} from 'lucide-react';
import SeccionTecnica, { ETIQUETAS_TECNICAS } from './SeccionTecnica';

const ICONOS = {
    team: Users,
    closer_aliases: UserCheck,
    leads_audit: ClipboardList,
    report_backlog: ShieldAlert,
    bug_reports: Bug,
    playbook: GraduationCap,
    bitacora: History,
    marketing: Share2,
    database: Database,
    operations: Activity,
    infra: HardDrive,
    danger_zone: AlertTriangle,
};

const sections = Object.keys(ETIQUETAS_TECNICAS).map(id => ({
    id, label: ETIQUETAS_TECNICAS[id], icon: ICONOS[id], danger: id === 'danger_zone',
}));

/**
 * El panel técnico completo en una sola pantalla, con las secciones en pestañas arriba (antes era
 * una columna vertical de 12 botones). Lo usa el admin por URL; el operador trabaja en
 * `OperadorEspacioPage`, que reparte las mismas secciones entre las del dock y sus pestañas.
 */
const OperationsSettingsPage = () => {
    const [activeSection, setActiveSection] = useState('team');

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            <header className="space-y-1">
                <h1 className="text-4xl font-black text-base italic tracking-tighter uppercase">Panel de Control Técnico</h1>
                <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Administración de datos y mantenimiento preventivo</p>
            </header>

            <div role="tablist" aria-label="Secciones del panel técnico" className="flex flex-wrap gap-2">
                {sections.map(section => (
                    <button
                        key={section.id}
                        type="button"
                        role="tab"
                        aria-selected={activeSection === section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`flex items-center gap-2 px-4 h-11 rounded-2xl transition-all ${activeSection === section.id
                                ? (section.danger ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'bg-primary text-white shadow-lg shadow-primary/20')
                                : (section.danger ? 'text-rose-500 hover:bg-rose-500/10' : 'text-muted hover:bg-surface-hover hover:text-base')
                            }`}
                    >
                        <section.icon size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{section.label}</span>
                    </button>
                ))}
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <SeccionTecnica id={activeSection} embebido />
            </div>
        </div>
    );
};

export default OperationsSettingsPage;
