import { useState } from 'react';
import {
    LayoutDashboard,
    Users,
    Database,
    BarChart3,
    Kanban,
    Settings,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    LogOut,
    Bell,
    Zap,
    DollarSign,
    Megaphone,
    Package
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import OnboardingTour from './OnboardingTour';
import OperatorControls from './OperatorControls';

const SidebarItem = ({ icon: Icon, label, path, active, collapsed, id }) => (
    <Link
        to={path}
        id={id}
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

const SidebarDropdown = ({ icon: Icon, label, items, collapsed, currentPath, id }) => {
    const [isOpen, setIsOpen] = useState(items.some(item => currentPath === item.path));

    return (
        <div className="space-y-1" id={id}>
            <button
                onClick={() => !collapsed && setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-4 px-7 text-muted hover:bg-surface-hover hover:text-base transition-all duration-300 rounded-2xl mx-1 ${items.some(item => currentPath === item.path) ? 'text-primary font-bold' : ''}`}
            >
                <div className="flex items-center gap-4">
                    <Icon size={22} />
                    {!collapsed && <span className="whitespace-nowrap tracking-tight">{label}</span>}
                </div>
                {!collapsed && (
                    <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                        <ChevronDown size={14} />
                    </div>
                )}
            </button>
            {isOpen && !collapsed && (
                <div className="ml-12 space-y-1 pr-4 animate-in slide-in-from-top-2 duration-300">
                    {items.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`block p-3 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${currentPath === item.path
                                ? 'bg-primary/10 text-primary'
                                : 'text-slate-500 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

const MainLayout = ({ children }) => {
    const [collapsed, setCollapsed] = useState(false);
    const location = useLocation();
    const { user, logout } = useAuth();

    if (!user) return null;

    const menuItems = (user.role === 'admin' || user.role === 'operator') ? [
        { type: 'link', icon: LayoutDashboard, label: 'Main Board', path: '/admin/dashboard', id: 'sidebar-dashboard' },
        { type: 'link', icon: DollarSign, label: 'Finanzas', path: '/admin/finance', id: 'sidebar-finance' },
        { type: 'link', icon: BarChart3, label: 'Ventas', path: '/admin/sales', id: 'sidebar-sales' },
        { type: 'link', icon: Megaphone, label: 'Marketing', path: '/admin/marketing', id: 'sidebar-marketing' },
        { type: 'link', icon: Package, label: 'Fulfillment', path: '/admin/fulfillment', id: 'sidebar-fulfillment' },
        { type: 'link', icon: Database, label: 'Bases de Datos', path: '/admin/database' },
        { type: 'link', icon: Settings, label: 'Configuracion', path: '/admin/settings' },
    ] : (user.role === 'setter') ? [
        { type: 'link', icon: BarChart3, label: 'Ventas', path: '/setter/dashboard' },
    ] : [
        { type: 'link', icon: LayoutDashboard, label: 'Main Board', path: '/closer/dashboard' },
        { type: 'link', icon: Kanban, label: 'Embudo', path: '/closer/embudo' },
        { type: 'link', icon: Database, label: 'Base de Datos', path: '/closer/leads' },
        { type: 'link', icon: Settings, label: 'Configuracion', path: '/closer/settings' },
    ];


    return (
        <div className="flex h-screen bg-main text-base overflow-hidden w-full selection:bg-primary/30">
            {/* Operator Controls Overlay */}
            <OperatorControls />

            {/* Tutorial Overlay */}
            <OnboardingTour />

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

                <nav className="flex-1 space-y-2 px-1 custom-scrollbar overflow-y-auto overflow-x-hidden">
                    {menuItems.map((item, idx) => (
                        item.type === 'link' ? (
                            <SidebarItem
                                key={item.path}
                                {...item}
                                active={location.pathname === item.path}
                                collapsed={collapsed}
                            />
                        ) : (
                            <SidebarDropdown
                                key={idx}
                                {...item}
                                collapsed={collapsed}
                                currentPath={location.pathname}
                            />
                        )
                    ))}
                </nav>

                <div className="p-4 mt-auto border-t border-base space-y-4">
                    {/* User Profile & Actions */}
                    <div className={`p-4 rounded-3xl bg-main/30 border border-base/50 flex flex-col gap-4 ${collapsed ? 'items-center px-1' : ''}`}>
                        <div className={`flex items-center gap-3 ${collapsed ? 'flex-col' : ''}`}>
                            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-lg shadow-lg shrink-0">
                                {user.username[0].toUpperCase()}
                            </div>
                            {!collapsed && (
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-black text-base leading-tight truncate">{user.username}</p>
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest truncate">{user.role}</p>
                                </div>
                            )}
                        </div>

                        <div className={`flex items-center gap-1 ${collapsed ? 'flex-col' : 'justify-between'}`}>
                            <button className="text-muted hover:text-base transition-all relative p-2 hover:bg-surface-hover rounded-xl group">
                                <Bell size={18} className="group-hover:scale-110 transition-transform" />
                                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary rounded-full border-2 border-surface animate-pulse"></span>
                                {collapsed && <span className="sr-only">Notificaciones</span>}
                            </button>

                            <button
                                onClick={logout}
                                className="text-muted hover:text-accent transition-all p-2 hover:bg-accent/10 rounded-xl flex items-center gap-2 group"
                                title="Cerrar Sesion"
                            >
                                <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
                                {!collapsed && <span className="text-[10px] font-black uppercase tracking-widest">Cerrar Sesión</span>}
                            </button>
                        </div>
                    </div>

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
                {/* Page Content */}
                <div id="app-main-scroll" className="flex-1 overflow-y-auto scroll-smooth">
                    <div className="min-h-full">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
