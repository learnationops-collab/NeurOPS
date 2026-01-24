import { useState } from 'react';
import {
    LayoutDashboard,
    Users,
    Database,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Bell,
    DollarSign,
    Shield
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';

const SidebarItem = ({ icon: Icon, label, path, active, collapsed }) => (
    <Link
        to={path}
        className={`flex items-center gap-4 p-4 mx-3 rounded-2xl transition-all duration-300 ${active
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold scale-[1.02]'
            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
            }`}
    >
        <div className="flex-shrink-0">
            <Icon size={22} />
        </div>
        {!collapsed && <span className="whitespace-nowrap tracking-tight">{label}</span>}
    </Link>
);

const MainLayout = ({ children }) => {
    const [collapsed, setCollapsed] = useState(false);
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{"username": "Usuario", "role": "closer"}');


    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
            window.location.href = '/login';
        } catch (err) {
            console.error("Logout failed", err);
            window.location.href = '/login';
        }
    };

    const menuItems = user.role === 'admin' ? [
        { icon: LayoutDashboard, label: 'Main Board', path: '/admin/dashboard' },
        { icon: BarChart3, label: 'Analisis Detallado', path: '/admin/analysis' },
        { icon: Database, label: 'Bases de Datos', path: '/admin/database' },
        { icon: Settings, label: 'Configuracion', path: '/admin/settings' },
    ] : [
        { icon: LayoutDashboard, label: 'Resumen Diario', path: '/closer/dashboard' },
        { icon: Database, label: 'Gestionar Leads', path: '/closer/leads' },
        { icon: Settings, label: 'Configuracion', path: '/closer/settings' },
    ];


    return (
        <div className="flex h-screen bg-[#0f172a] text-slate-200 overflow-hidden w-full selection:bg-indigo-500/30">
            {/* Sidebar */}
            <aside className={`bg-slate-900 border-r border-slate-800/50 flex flex-col transition-all duration-500 ease-in-out z-20 ${collapsed ? 'w-24' : 'w-72'}`}>
                <div className="h-24 flex items-center px-8 mb-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                        <div className="w-4 h-4 bg-white rounded-sm rotate-45"></div>
                    </div>
                    {!collapsed && (
                        <span className="ml-4 text-2xl font-black text-white italic tracking-tighter uppercase whitespace-nowrap">
                            LEARN<span className="text-indigo-500 font-black">ATION</span>
                        </span>
                    )}
                </div>

                <nav className="flex-1 space-y-2 px-1">
                    {menuItems.map((item) => (
                        <SidebarItem
                            key={item.path}
                            {...item}
                            active={location.pathname === item.path}
                            collapsed={collapsed}
                        />
                    ))}
                </nav>

                <div className="p-6 border-t border-slate-800/50">
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="w-full flex items-center justify-center gap-3 py-3 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-2xl transition-all duration-300 border border-transparent hover:border-slate-700"
                    >
                        {collapsed ? <ChevronRight size={22} /> : <><ChevronLeft size={20} /> <span className="text-xs font-black uppercase tracking-widest">Colapsar</span></>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-br from-[#0f172a] to-[#1e293b]">
                {/* Header */}
                <header className="h-20 px-10 flex items-center justify-between border-b border-slate-800/50 bg-slate-900/20 backdrop-blur-xl sticky top-0 z-10 shrink-0">
                    <div className="flex items-center gap-4 text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-[0.2em]">{location.pathname.split('/').pop()}</span>
                    </div>

                    <div className="flex items-center gap-8">
                        <button className="text-slate-400 hover:text-white transition-colors relative">
                            <Bell size={20} />
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full"></span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className="text-slate-500 hover:text-rose-500 transition-colors p-2 hover:bg-rose-500/10 rounded-xl"
                            title="Cerrar Sesion"
                        >
                            <LogOut size={20} />
                        </button>

                        <div className="flex items-center gap-4 group cursor-pointer">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-black text-white leading-tight">{user.username}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{user.role}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-lg shadow-lg group-hover:scale-105 transition-transform">
                                A
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto scroll-smooth">
                    <div className="min-h-full">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
