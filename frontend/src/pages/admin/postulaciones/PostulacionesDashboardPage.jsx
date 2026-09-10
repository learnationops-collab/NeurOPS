import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, CheckCircle2, Users, BarChart3, Sliders, ArrowLeft } from 'lucide-react';
import PostulacionesInbox from './components/PostulacionesInbox';
import PostulacionesRevisoresTab from './components/PostulacionesRevisoresTab';
import PostulacionesStatsTab from './components/PostulacionesStatsTab';
import PostulacionesClarityTab from './components/PostulacionesClarityTab';

// Antes "Postulantes" era una sola pestaña con un selector de vista adentro
// (Revisión/En reserva/Incompletas). Se separa en "Pendientes" y "Analizados"
// como pestañas propias del menú inferior — pedido del usuario a partir de un
// mockup de referencia ("Panel de postulaciones (standalone) (1).html"): cada
// una muestra solo los sub-filtros que le corresponden (ver PostulacionesInbox,
// prop `grupo`), en vez de una sola lista larga de filtros mezclados.
const TABS = [
    { id: 'pendientes', label: 'Pendientes', icon: Inbox },
    { id: 'analizados', label: 'Analizados', icon: CheckCircle2 },
    { id: 'revisores', label: 'Revisores', icon: Users },
    { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
    { id: 'clarity', label: 'Clarity', icon: Sliders },
];

const PostulacionesDashboardPage = () => {
    const [activeTab, setActiveTab] = useState('pendientes');

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

            <div className="w-full px-8 py-8 pb-40">
                {activeTab === 'pendientes' && <PostulacionesInbox grupo="pend" />}
                {activeTab === 'analizados' && <PostulacionesInbox grupo="anal" />}
                {activeTab === 'revisores' && <PostulacionesRevisoresTab />}
                {activeTab === 'estadisticas' && <PostulacionesStatsTab />}
                {activeTab === 'clarity' && <PostulacionesClarityTab />}
            </div>

            {/* Menú inferior propio de Postulaciones: reemplaza al dock global del admin
                (oculto porque esta ruta no usa MainLayout) mientras se está acá adentro.
                Pestañas grandes y siempre con ícono + etiqueta (antes las inactivas se
                achicaban a un círculo de solo ícono) — pedido explícito del usuario para
                acercarse al mockup de referencia, que nunca las colapsa. */}
            <div className="fixed bottom-6 left-0 w-full flex justify-center z-50 pointer-events-none px-4">
                <div className="pointer-events-auto flex items-center gap-2 bg-[#020617]/95 backdrop-blur-2xl border border-white/[.14] rounded-2xl p-2 shadow-2xl overflow-x-auto max-w-full">
                    {TABS.map((tab, i) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex flex-none items-center gap-3 rounded-xl px-6 h-[60px] min-w-[168px] transition-all duration-300 ${
                                    isActive
                                        ? 'text-[#020617] shadow-lg'
                                        : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                                style={isActive ? { background: 'linear-gradient(100deg,#FF3FA4 0%,#FF6AD5 35%,#FF3FA4 70%,#FF6AD5 100%)' } : undefined}
                            >
                                <span
                                    className="text-[9.5px] font-black tracking-[2px]"
                                    style={{ color: isActive ? 'rgba(2,6,23,.55)' : 'rgba(255,255,255,.4)' }}
                                >
                                    0{i}
                                </span>
                                <tab.icon size={18} />
                                <span className="text-[13px] font-bold whitespace-nowrap">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PostulacionesDashboardPage;
