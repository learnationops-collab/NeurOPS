import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Users, BarChart3, Sliders, ArrowLeft } from 'lucide-react';
import PostulacionesInbox from './components/PostulacionesInbox';
import PostulacionesRevisoresTab from './components/PostulacionesRevisoresTab';
import PostulacionesStatsTab from './components/PostulacionesStatsTab';
import PostulacionesClarityTab from './components/PostulacionesClarityTab';

const TABS = [
    { id: 'postulaciones', label: 'Postulantes', icon: Inbox },
    { id: 'revisores', label: 'Revisores', icon: Users },
    { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
    { id: 'clarity', label: 'Clarity', icon: Sliders },
];

const PostulacionesDashboardPage = () => {
    const [activeTab, setActiveTab] = useState('postulaciones');

    return (
        // Vive fuera de MainLayout (ver App.jsx): es su propia "sub-app" con header
        // y menú inferior propios, no una página más dentro del dock del admin —
        // por eso pisa la paleta con dash-v6 y maneja su propio scroll de pantalla
        // completa en vez de heredar el <main> con dock flotante de MainLayout.
        <div className="dash-v6 h-screen overflow-y-auto bg-main text-base pb-32">
            <header className="top-v6">
                <div className="topin">
                    <Link
                        to="/admin/ventas"
                        className="flex-none flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-muted hover:text-white hover:bg-white/10 transition-all group"
                        title="Volver a la sesión del admin"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    </Link>
                    <div className="brand-v6">
                        <div className="logo-v6">L</div>
                        <div>
                            <h1>Learnation</h1>
                            <small>Postulaciones · Closer de ventas</small>
                        </div>
                    </div>
                    <div className="flex-1" />
                    <span className="hidden md:inline text-pink-400 font-black text-[10px] uppercase tracking-[0.3em]">
                        Búsqueda activa
                    </span>
                </div>
            </header>

            <div className="w-full px-8 py-8">
                {activeTab === 'postulaciones' && <PostulacionesInbox />}
                {activeTab === 'revisores' && <PostulacionesRevisoresTab />}
                {activeTab === 'estadisticas' && <PostulacionesStatsTab />}
                {activeTab === 'clarity' && <PostulacionesClarityTab />}
            </div>

            {/* Menú inferior propio de Postulaciones: reemplaza al dock global del admin
                (oculto porque esta ruta no usa MainLayout) mientras se está acá adentro. */}
            <div className="fixed bottom-6 left-0 w-full flex justify-center z-50 pointer-events-none px-4">
                <div className="pointer-events-auto flex items-center gap-1.5 bg-[#1a1c23]/95 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-1.5 shadow-2xl">
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                title={tab.label}
                                className={`flex items-center justify-center gap-2 rounded-full transition-all duration-300 ${
                                    isActive
                                        ? 'bg-primary text-white px-5 h-11 shadow-lg shadow-primary/30'
                                        : 'w-11 h-11 text-muted/60 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <tab.icon size={18} />
                                {isActive && (
                                    <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                        {tab.label}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PostulacionesDashboardPage;
