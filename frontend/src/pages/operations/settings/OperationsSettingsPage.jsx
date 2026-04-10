import { useState } from 'react';
import {
    Database,
    AlertTriangle,
    Terminal,
    Shield,
    HardDrive,
    Activity,
    Users
} from 'lucide-react';
import DatabasePage from '../../admin/database/DatabasePage';
import OperationsPage from '../../admin/database/OperationsPage';
import TeamManagementPage from '../../admin/team/TeamManagementPage';
import Card from '../../../components/ui/Card';

const OperationsSettingsPage = () => {
    const [activeSection, setActiveSection] = useState('team');

    const sections = [
        { id: 'team', label: 'Gestión de Equipo', icon: Users },
        { id: 'database', label: 'Base de Datos', icon: Database },
        { id: 'operations', label: 'Operaciones Críticas', icon: Activity },
        { id: 'infra', label: 'Infraestructura', icon: HardDrive },
        { id: 'danger_zone', label: 'Zona de Peligro', icon: AlertTriangle, danger: true },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="space-y-1">
                <h1 className="text-4xl font-black text-base italic tracking-tighter uppercase">Panel de Control Técnico</h1>
                <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Administración de datos y mantenimiento preventivo</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                {/* Sidebar Menu */}
                <div className="lg:col-span-1 space-y-2">
                    {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full flex items-center gap-4 p-5 rounded-3xl transition-all ${activeSection === section.id
                                    ? (section.danger ? 'bg-rose-600 text-white shadow-xl shadow-rose-600/20' : 'bg-primary text-white shadow-xl shadow-primary/20')
                                    : (section.danger ? 'text-rose-500 hover:bg-rose-500/10' : 'text-muted hover:bg-surface-hover hover:text-base')
                                }`}
                        >
                            <section.icon size={20} />
                            <span className="text-xs font-black uppercase tracking-widest">{section.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3">
                    {activeSection === 'team' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <TeamManagementPage />
                        </div>
                    )}

                    {activeSection === 'database' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <DatabasePage />
                        </div>
                    )}

                    {(activeSection === 'operations' || activeSection === 'danger_zone') && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <OperationsPage />
                        </div>
                    )}

                    {activeSection === 'infra' && (
                        <Card variant="surface" className="p-10 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-amber-500/5 border-amber-500/10">
                            <div className="flex items-center gap-4 text-amber-500">
                                <Shield size={32} />
                                <h3 className="text-xl font-black italic tracking-tighter uppercase">Monitor de Infraestructura</h3>
                            </div>
                            <p className="text-sm text-muted font-medium leading-relaxed">
                                Estas configuraciones permiten gestionar el despliegue y los límites de recursos del servidor. ( Bajo Construcción )
                            </p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OperationsSettingsPage;
