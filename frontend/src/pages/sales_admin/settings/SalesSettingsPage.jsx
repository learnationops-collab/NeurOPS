import { useState } from 'react';
import {
    Settings,
    Shield,
    Bell,
    Key,
    Plus,
    ClipboardCheck,
    Package,
    CreditCard,
    Layers,
    Kanban as KanbanIcon
} from 'lucide-react';
import ReportQuestionsManager from '../../../components/admin/ReportQuestionsManager';
import ProgramsManager from '../../../components/sales/ProgramsManager';
import FunnelsManager from '../../../components/sales/FunnelsManager';
import IntegrationsManager from '../../../components/admin/IntegrationsManager';
import GoogleCalendarSettings from '../../../components/GoogleCalendarSettings';
import PaymentMethodsManager from '../../../components/sales/PaymentMethodsManager';
import PipelineStagesManager from '../../../components/sales/PipelineStagesManager';
import Card from '../../../components/ui/Card';

const SalesSettingsPage = () => {
    const [activeSection, setActiveSection] = useState('programs');

    const sections = [
        { id: 'programs', label: 'Programas', icon: Package },
        { id: 'payment_methods', label: 'Metodos de Pago', icon: CreditCard },
        { id: 'funnels', label: 'Embudos y Eventos', icon: Layers },
        { id: 'kanban', label: 'Estructura Kanban', icon: KanbanIcon },
        { id: 'questions', label: 'Preguntas de Reporte', icon: ClipboardCheck },
        { id: 'integrations', label: 'Integraciones', icon: Key },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="space-y-1">
                <h1 className="text-4xl font-black text-base italic tracking-tighter uppercase">Configuración de Ventas</h1>
                <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Gestión de embudos, productos y automatizaciones</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                {/* Sidebar Menu */}
                <div className="lg:col-span-1 space-y-2">
                    {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full flex items-center gap-4 p-5 rounded-3xl transition-all ${activeSection === section.id
                                ? 'bg-primary text-white shadow-xl shadow-primary/20'
                                : 'text-muted hover:bg-surface-hover hover:text-base'
                                }`}
                        >
                            <section.icon size={20} />
                            <span className="text-xs font-black uppercase tracking-widest">{section.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3">
                    {activeSection === 'programs' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <ProgramsManager />
                        </div>
                    )}

                    {activeSection === 'payment_methods' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <PaymentMethodsManager />
                        </div>
                    )}

                    {activeSection === 'questions' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <ReportQuestionsManager />
                        </div>
                    )}

                    {activeSection === 'funnels' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500 text-left">
                            <FunnelsManager />
                        </div>
                    )}

                    {activeSection === 'kanban' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500 text-left">
                            <PipelineStagesManager />
                        </div>
                    )}

                    {activeSection === 'integrations' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <IntegrationsManager />
                            <div className="border-t border-base opacity-20 my-4" />
                            <GoogleCalendarSettings />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalesSettingsPage;
