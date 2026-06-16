import React, { useState, useEffect } from 'react';
import { 
    Bell, 
    Settings, 
    ClipboardList 
} from 'lucide-react';
import AlertsCenter from '../../../components/admin/alerts/AlertsCenter';
import AlertRulesConfig from '../../../components/admin/alerts/AlertRulesConfig';
import api from '../../../services/api';

const AlertsHubPage = () => {
    const [activeTab, setActiveTab] = useState('center'); // 'center', 'rules', 'history'
    const [stats, setStats] = useState({
        alerts: { critical: 0, warning: 0, info: 0, opportunity: 0, total_last_week: 0 },
        rules: { total: 0 }
    });

    const loadStats = async () => {
        try {
            const res = await api.get('/alerts/stats');
            setStats(res.data);
        } catch (err) {
            console.error("Error al cargar estadísticas de alertas:", err);
        }
    };

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 10000); // Refrescar stats cada 10s
        return () => clearInterval(interval);
    }, []);

    // Conteo de alertas activas totales
    const activeAlertsCount = stats.alerts.critical + stats.alerts.warning + stats.alerts.info + stats.alerts.opportunity;

    const tabs = [
        { 
            id: 'center', 
            label: 'Centro de alertas', 
            icon: Bell, 
            badge: activeAlertsCount > 0 ? activeAlertsCount : null 
        },
        { 
            id: 'rules', 
            label: 'Configuración de alertas', 
            icon: Settings 
        },
        { 
            id: 'history', 
            label: 'Historial', 
            icon: ClipboardList 
        }
    ];

    return (
        <div className="relative bg-background min-h-screen space-y-6">
            {/* Header: Tab Selector & Title inline */}
            <div className="p-8 pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex gap-2 p-1 bg-surface border border-base rounded-2xl w-fit">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                                activeTab === tab.id 
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                    : 'text-muted hover:text-white'
                            }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                            {tab.badge && (
                                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-[#1a1c23] animate-pulse">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Title on the top-right corner */}
                <div className="text-right pr-2 hidden md:block">
                    <p className="text-blue-400 font-bold tracking-widest text-[9px] uppercase leading-none mb-1">NeurOPS High Performance</p>
                    <h1 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Centro de Alertas
                    </h1>
                </div>
            </div>

            {/* Content Area */}
            <div className="w-full">
                {activeTab === 'center' && (
                    <AlertsCenter stats={stats} refreshStats={loadStats} />
                )}
                {activeTab === 'rules' && (
                    <AlertRulesConfig stats={stats} refreshStats={loadStats} />
                )}
                {activeTab === 'history' && (
                    <AlertsCenter stats={stats} refreshStats={loadStats} isHistoryMode={true} />
                )}
            </div>
        </div>
    );
};

export default AlertsHubPage;
