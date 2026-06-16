import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    Users, 
    Activity, 
    BarChart3, 
    Target, 
    TrendingUp, 
    Bell, 
    Zap, 
    Settings, 
    ClipboardList,
    ChevronRight,
    ChevronLeft,
    Compass
} from 'lucide-react';
import AlertsCenter from '../../../components/admin/alerts/AlertsCenter';
import AlertRulesConfig from '../../../components/admin/alerts/AlertRulesConfig';
import api from '../../../services/api';

const AlertsHubPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('center'); // 'center', 'rules', 'history'
    const [stats, setStats] = useState({
        alerts: { critical: 0, warning: 0, info: 0, opportunity: 0, total_last_week: 0 },
        rules: { total: 0 }
    });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

    const sidebarItems = {
        principal: [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/ventas' },
            { id: 'leads', label: 'Leads', icon: Users, path: '/closer/clients' },
            { id: 'roadmap', label: 'Lead Roadmap', icon: Compass, path: '/unattributed-leads' },
            { id: 'reportes', label: 'Reportes', icon: BarChart3, path: '/admin/ventas' },
            { id: 'anuncios', label: 'Anuncios', icon: Target, path: '/admin/marketing' },
            { id: 'keywords', label: 'Palabras clave', icon: TrendingUp, path: '/admin/marketing' },
        ],
        alertas: [
            { id: 'center', label: 'Centro de alertas', icon: Bell, badge: activeAlertsCount > 0 ? activeAlertsCount : null, color: 'bg-rose-500 text-white' },
            { id: 'rules', label: 'Reglas de alertas', icon: Zap },
            { id: 'config', label: 'Configuración de alertas', icon: Settings },
            { id: 'history', label: 'Historial', icon: ClipboardList }
        ],
        configuracion: [
            { id: 'integrations', label: 'Integraciones', icon: Settings, path: '/ops/dashboard' },
            { id: 'users', label: 'Usuarios', icon: Users, path: '/ops/dashboard' }, // Redirección temporal o control
            { id: 'ajustes', label: 'Ajustes', icon: Settings, path: '/ops/dashboard' }
        ]
    };

    const handleItemClick = (item) => {
        if (item.path) {
            navigate(item.path);
        } else {
            setActiveTab(item.id === 'config' ? 'rules' : item.id);
        }
    };

    return (
        <div className="flex bg-[#0b0c10] text-slate-100 min-h-screen relative w-full overflow-hidden">
            {/* Left Side Navigation Bar (ADSPRO) */}
            <aside 
                className={`flex flex-col border-r border-white/5 bg-[#0e1017]/80 backdrop-blur-2xl transition-all duration-300 z-30 shrink-0 ${
                    sidebarCollapsed ? 'w-20' : 'w-64'
                }`}
            >
                {/* Logo Section */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    {!sidebarCollapsed && (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-sm text-white tracking-widest shadow-lg shadow-blue-500/20">
                                AP
                            </div>
                            <span className="font-black tracking-[0.2em] text-white text-xs uppercase">ADSPRO</span>
                        </div>
                    )}
                    {sidebarCollapsed && (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-sm text-white m-auto">
                            AP
                        </div>
                    )}
                    <button 
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                    >
                        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                {/* Sidebar Navigation Items */}
                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-7 custom-scrollbar text-left">
                    {/* Grupo PRINCIPAL */}
                    <div className="space-y-2">
                        {!sidebarCollapsed && <p className="text-[9px] font-black tracking-widest text-slate-500 uppercase px-3">Principal</p>}
                        <ul className="space-y-1">
                            {sidebarItems.principal.map(item => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => handleItemClick(item)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all group"
                                    >
                                        <item.icon size={18} className="group-hover:scale-105 transition-transform" />
                                        {!sidebarCollapsed && <span className="text-xs font-bold">{item.label}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Grupo ALERTAS */}
                    <div className="space-y-2">
                        {!sidebarCollapsed && <p className="text-[9px] font-black tracking-widest text-slate-500 uppercase px-3">Alertas</p>}
                        <ul className="space-y-1">
                            {sidebarItems.alertas.map(item => {
                                const isSelected = activeTab === item.id || (item.id === 'config' && activeTab === 'rules');
                                return (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => handleItemClick(item)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${
                                                isSelected 
                                                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <item.icon size={18} className="group-hover:scale-105 transition-transform" />
                                                {!sidebarCollapsed && <span className="text-xs font-bold">{item.label}</span>}
                                            </div>
                                            {item.badge && !sidebarCollapsed && (
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${item.color || 'bg-blue-500 text-white'}`}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* Grupo CONFIGURACIÓN */}
                    <div className="space-y-2">
                        {!sidebarCollapsed && <p className="text-[9px] font-black tracking-widest text-slate-500 uppercase px-3">Configuración</p>}
                        <ul className="space-y-1">
                            {sidebarItems.configuracion.map(item => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => handleItemClick(item)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all group"
                                    >
                                        <item.icon size={18} className="group-hover:scale-105 transition-transform" />
                                        {!sidebarCollapsed && <span className="text-xs font-bold">{item.label}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Footer / User Profile section */}
                <div className="p-4 border-t border-white/5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                        AD
                    </div>
                    {!sidebarCollapsed && (
                        <div className="text-left leading-none">
                            <p className="text-xs font-bold text-white">Admin</p>
                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-0.5">Administrador</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {activeTab === 'center' && (
                    <AlertsCenter stats={stats} refreshStats={loadStats} />
                )}
                {activeTab === 'rules' && (
                    <AlertRulesConfig stats={stats} refreshStats={loadStats} />
                )}
                {activeTab === 'history' && (
                    <AlertsCenter stats={stats} refreshStats={loadStats} isHistoryMode={true} />
                )}
            </main>
        </div>
    );
};

export default AlertsHubPage;
