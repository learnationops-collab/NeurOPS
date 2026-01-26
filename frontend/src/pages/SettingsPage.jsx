import { useState, useEffect } from 'react';
import api from '../services/api';
import { Settings, Shield, User, LogOut, Bell, Key, Plus, Trash2, ClipboardCheck, Loader2, Check, X, Package, CreditCard, Palette, Layers } from 'lucide-react';
import UsersPage from './UsersPage';
import ReportQuestionsManager from '../components/ReportQuestionsManager';
import ProgramsManager from '../components/ProgramsManager';
import FunnelsManager from '../components/FunnelsManager';
import IntegrationsManager from '../components/IntegrationsManager';
import PaymentMethodsManager from '../components/PaymentMethodsManager';
import Card from '../components/ui/Card';
import ThemeSelector from '../components/ui/ThemeSelector';

const SettingsPage = () => {
    const [activeSection, setActiveSection] = useState('team');

    const sections = [
        { id: 'profile', label: 'Mi Cuenta', icon: User },
        { id: 'team', label: 'Gestion de Equipo', icon: Shield },
        { id: 'programs', label: 'Programas', icon: Package },
        { id: 'payment_methods', label: 'Metodos de Pago', icon: CreditCard },
        { id: 'funnels', label: 'Embudos y Eventos', icon: Layers },
        { id: 'questions', label: 'Preguntas de Reporte', icon: ClipboardCheck },
        { id: 'appearance', label: 'Apariencia', icon: Palette },
        { id: 'integrations', label: 'Integraciones', icon: Key },
    ];

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
            window.location.href = '/login';
        } catch (err) {
            window.location.href = '/login';
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="space-y-1">
                <h1 className="text-4xl font-black text-base italic tracking-tighter">Configuración del Sistema</h1>
                <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Preferencias y administración global</p>
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
                    <div className="pt-4 mt-4 border-t border-base">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-4 p-5 rounded-3xl text-accent hover:bg-accent/10 transition-all"
                        >
                            <LogOut size={20} />
                            <span className="text-xs font-black uppercase tracking-widest">Cerrar Sesión</span>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3">
                    {activeSection === 'team' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <UsersPage />
                        </div>
                    )}

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

                    {activeSection === 'profile' && (
                        <Card variant="surface" className="p-10 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 text-center py-20">
                            <div className="w-24 h-24 bg-primary rounded-3xl mx-auto flex items-center justify-center text-3xl font-black text-white shadow-2xl">A</div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-base">Admin User</h3>
                                <p className="text-sm text-muted">admin@learnation.com</p>
                            </div>
                            <button className="px-8 py-3 bg-base hover:bg-surface-hover text-base text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all border border-base">Cambiar Contraseña</button>
                        </Card>
                    )}

                    {activeSection === 'integrations' && (
                        <IntegrationsManager />
                    )}

                    {activeSection === 'appearance' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
                            <div className="bg-surface p-10 rounded-[2.5rem] border border-base space-y-6">
                                <div>
                                    <h3 className="text-xl font-black text-base italic uppercase tracking-tight">Personalización de Interfaz</h3>
                                    <p className="text-xs text-muted font-bold uppercase tracking-widest mt-1">Elige el tema que mejor se adapte a tu flujo de trabajo</p>
                                </div>
                                <div className="pt-4">
                                    <ThemeSelector />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
