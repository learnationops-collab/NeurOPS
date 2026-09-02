import React, { useState } from 'react';
import { Inbox, BarChart3, Sliders } from 'lucide-react';
import PostulacionesInbox from './components/PostulacionesInbox';
import PostulacionesStatsTab from './components/PostulacionesStatsTab';
import PostulacionesClarityTab from './components/PostulacionesClarityTab';

const TABS = [
    { id: 'postulaciones', label: 'Postulaciones', icon: Inbox },
    { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
    { id: 'clarity', label: 'Clarity', icon: Sliders },
];

const PostulacionesDashboardPage = () => {
    const [activeTab, setActiveTab] = useState('postulaciones');

    return (
        // dash-v6: pisa las variables --color-* con la paleta de marca Learnation
        // (magenta #FF3FA4 sobre navy), igual que el Dashboard de Closers, para que
        // el panel no cambie de look con el tema admin elegido (Elegant Blue, Glass...).
        <div className="dash-v6 relative bg-main min-h-screen space-y-6">
            <div className="p-8 pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex gap-2 p-1 bg-surface border border-base rounded-2xl w-fit">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeTab === tab.id
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'text-muted hover:text-white'
                            }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="text-right pr-2 hidden md:block">
                    <p className="text-pink-400 font-bold tracking-widest text-[9px] uppercase leading-none mb-1">Búsqueda activa</p>
                    <h1 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Postulaciones · Closer de ventas
                    </h1>
                </div>
            </div>

            <div className="w-full px-8 pb-8">
                {activeTab === 'postulaciones' && <PostulacionesInbox />}
                {activeTab === 'estadisticas' && <PostulacionesStatsTab />}
                {activeTab === 'clarity' && <PostulacionesClarityTab />}
            </div>
        </div>
    );
};

export default PostulacionesDashboardPage;
