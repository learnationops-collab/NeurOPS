import { useState } from 'react';
import api from '../../../services/api';
import { Shield, User, LogOut, Palette, AlertTriangle } from 'lucide-react';
import UsersPage from '../../legacy/UsersPage';
import Card from '../../../components/ui/Card';
import ThemeSelector from '../../../components/ui/ThemeSelector';

const SettingsPage = () => {
    const [activeSection, setActiveSection] = useState('team');

    const sections = [
        { id: 'profile', label: 'Mi Cuenta', icon: User },
        { id: 'team', label: 'Gestion de Equipo', icon: Shield },
        { id: 'appearance', label: 'Apariencia', icon: Palette },
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
                                ? (section.danger ? 'bg-rose-600 text-white shadow-xl shadow-rose-600/20' : 'bg-primary text-white shadow-xl shadow-primary/20')
                                : (section.danger ? 'text-rose-500 hover:bg-rose-500/10' : 'text-muted hover:bg-surface-hover hover:text-base')
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
