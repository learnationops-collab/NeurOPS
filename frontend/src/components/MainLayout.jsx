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
    Shield,
    Zap
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import OperatorControls from './OperatorControls';

const SidebarItem = ({ icon: Icon, label, path, active, collapsed }) => (
    <Link
        to={path}
        className={`flex items-center gap-4 p-4 mx-3 rounded-2xl transition-all duration-300 ${active
            ? 'bg-primary text-white shadow-lg shadow-primary/30 font-bold scale-[1.02]'
            : 'text-muted hover:bg-surface-hover hover:text-base'
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

    const menuItems = (user.role === 'admin' || user.role === 'operator') ? [
        { icon: LayoutDashboard, label: 'Main Board', path: '/admin/dashboard' },
        { icon: BarChart3, label: 'Analisis Detallado', path: '/admin/analysis' },
        { icon: Database, label: 'Bases de Datos', path: '/admin/database' },
        { icon: Zap, label: 'Operaciones', path: '/admin/operations' },
        { icon: Settings, label: 'Configuracion', path: '/admin/settings' },
    ] : [
        { icon: LayoutDashboard, label: 'Resumen Diario', path: '/closer/dashboard' },
        { icon: Database, label: 'Gestionar Leads', path: '/closer/leads' },
        { icon: Settings, label: 'Configuracion', path: '/closer/settings' },
    ];


    return (
        <div className="flex h-screen bg-main text-base overflow-hidden w-full selection:bg-primary/30">
            {/* Operator Controls Overlay */}
            <OperatorControls />

            {/* Sidebar */}
            <aside className={`bg-surface border-r border-base flex flex-col transition-all duration-500 ease-in-out z-20 ${collapsed ? 'w-24' : 'w-72'}`}>
                <div className="h-24 flex items-center px-8 mb-4">
                    <div className="w-10 h-10 bg-primary rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg shadow-primary/20">
                        <div className="w-4 h-4 bg-white rounded-sm rotate-45"></div>
                    </div>
                    {!collapsed && (
                        <span className="ml-4 text-2xl font-black text-base italic tracking-tighter uppercase whitespace-nowrap">
                            LEARN<span className="text-primary font-black">ATION</span>
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

                <div className="p-6 border-t border-base">
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="w-full flex items-center justify-center gap-3 py-3 text-muted hover:text-base hover:bg-surface-hover rounded-2xl transition-all duration-300 border border-transparent hover:border-base"
                    >
                        {collapsed ? <ChevronRight size={22} /> : <><ChevronLeft size={20} /> <span className="text-xs font-black uppercase tracking-widest">Colapsar</span></>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-main">
                {/* Header */}
                <header className="h-20 px-10 flex items-center justify-between border-b border-base bg-surface shadow-sm sticky top-0 z-10 shrink-0">
                    <div className="flex items-center gap-4 text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-[0.2em]">{location.pathname.split('/').pop()}</span>
                    </div>

                    <div className="flex items-center gap-8">
                        <button className="text-muted hover:text-base transition-colors relative">
                            <Bell size={20} />
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full"></span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className="text-muted hover:text-accent transition-colors p-2 hover:bg-accent/10 rounded-xl"
                            title="Cerrar Sesion"
                        >
                            <LogOut size={20} />
                        </button>

                        <div className="flex items-center gap-4 group cursor-pointer text-muted hover:text-base transition-colors">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-black text-base leading-tight">{user.username}</p>
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{user.role}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-lg shadow-lg group-hover:scale-105 transition-transform">
                                {user.username[0].toUpperCase()}
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
