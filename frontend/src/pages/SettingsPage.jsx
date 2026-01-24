import { useState, useEffect } from 'react';
import api from '../services/api';
import { Settings, Shield, User, LogOut, Bell, Key, Plus, Trash2, ClipboardCheck, Loader2, Check, X } from 'lucide-react';
import UsersPage from './UsersPage';
import ReportQuestionsManager from '../components/ReportQuestionsManager';

const SettingsPage = () => {
    const [activeSection, setActiveSection] = useState('team');

    const sections = [
        { id: 'profile', label: 'Mi Cuenta', icon: User },
        { id: 'team', label: 'Gestion de Equipo', icon: Shield },
        { id: 'questions', label: 'Preguntas de Reporte', icon: ClipboardCheck },
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
        <div className="p-8 max-w-7xl mx-auto space-y-10">
            <header>
                <h1 className="text-3xl font-black text-white italic tracking-tighter">Configuracion del Sistema</h1>
                <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Preferencias y administracion global</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                {/* Sidebar Menu */}
                <div className="lg:col-span-1 space-y-2">
                    {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full flex items-center gap-4 p-5 rounded-3xl transition-all ${activeSection === section.id
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                                : 'text-slate-500 hover:bg-slate-800/50 hover:text-white'
                                }`}
                        >
                            <section.icon size={20} />
                            <span className="text-xs font-black uppercase tracking-widest">{section.label}</span>
                        </button>
                    ))}
                    <div className="pt-4 mt-4 border-t border-slate-800">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-4 p-5 rounded-3xl text-rose-500 hover:bg-rose-500/10 transition-all"
                        >
                            <LogOut size={20} />
                            <span className="text-xs font-black uppercase tracking-widest">Cerrar Sesion</span>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3">
                    {activeSection === 'team' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Reuse the UsersPage component directly here? 
                                Or simplify it. Let's just render the team list 
                                directly or import the component logic. */}
                            <UsersPage />
                        </div>
                    )}

                    {activeSection === 'questions' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <ReportQuestionsManager />
                        </div>
                    )}

                    {activeSection === 'profile' && (
                        <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 text-center py-20">
                            <div className="w-24 h-24 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-3xl font-black text-white shadow-2xl">A</div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-white">Admin User</h3>
                                <p className="text-sm text-slate-500">admin@learnation.com</p>
                            </div>
                            <button className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all border border-slate-700">Cambiar Contraseña</button>
                        </div>
                    )}

                    {activeSection === 'integrations' && (
                        <div className="p-10 text-center space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="w-20 h-20 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center text-slate-500">
                                <Key size={32} />
                            </div>
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Modulos de Integracion (Beta)</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
