import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    LayoutDashboard,
    DollarSign,
    BarChart3,
    Megaphone,
    Package,
    Database,
    Settings,
    LogOut,
    ChevronUp
} from 'lucide-react';

const DockItem = ({ icon: Icon, label, path, active, onClick, sections = [], activeSub = 0, onSectionClick, forceShowSubMenu }) => {
    const [isHovered, setIsHovered] = useState(false);
    const showSubMenu = isHovered || (active && forceShowSubMenu);

    const content = (
        <motion.div
            layout
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
                relative group flex items-center gap-2 p-3 rounded-2xl transition-all duration-500
                ${active
                    ? 'bg-primary text-white shadow-lg shadow-primary/30 px-4'
                    : 'text-muted hover:bg-surface-hover hover:text-base'
                }
            `}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
        >
            <div className="relative">
                <Icon size={20} />
                {active && sections.length > 1 && (
                    <div className="absolute -right-1.5 top-0 bottom-0 flex flex-col justify-center gap-0.5">
                        {sections.map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={`w-1 h-1 rounded-full ${activeSub === i ? 'bg-white' : 'bg-white/30'}`}
                            />
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence mode="popLayout">
                {active && (
                    <motion.span
                        initial={{ opacity: 0, width: 0, x: -10 }}
                        animate={{ opacity: 1, width: 'auto', x: 0 }}
                        exit={{ opacity: 0, width: 0, x: -10 }}
                        className="text-[10px] uppercase tracking-widest whitespace-nowrap overflow-hidden ml-1"
                    >
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>

            {/* Vertical Sub-Menu (Dropdown) */}
            <AnimatePresence>
                {active && showSubMenu && sections.length > 1 && (
                    <motion.div
                        initial={{ opacity: 0, y: 15, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 15, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="absolute bottom-full left-0 right-0 mb-1 p-1 glass-panel shadow-2xl flex flex-col-reverse gap-0.5 border-white/20 overflow-hidden z-[60] rounded-[2rem]"
                    >
                        {sections.map((section, i) => (
                            <button
                                key={section}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onSectionClick(i);
                                }}
                                className={`
                                    w-full px-2 py-2 rounded-xl text-[8px] uppercase tracking-tighter font-black transition-all text-center whitespace-nowrap
                                    ${activeSub === i
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                        : 'text-muted hover:bg-white/10 hover:text-white'
                                    }
                                `}
                            >
                                {section}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tooltip (Only if not active) */}
            {!active && (
                <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-surface border border-base px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl transform origin-bottom font-light">
                    {label}
                </span>
            )}
        </motion.div>
    );

    if (onClick && !path) {
        return <button onClick={onClick}>{content}</button>;
    }

    return (
        <Link to={path} onClick={onClick}>
            {content}
        </Link>
    );
};

const DockDivider = () => (
    <div className="w-px h-6 bg-base/30 mx-1 self-center" />
);

const Dock = ({ isVisible = true, onToggleVisibility, onSettingsClick, isSettingsOpen }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [userMenuIdx, setUserMenuIdx] = useState(0);
    const [activePageSection, setActivePageSection] = useState({ category: '', index: 0 });
    const [forceShowVerticalMenu, setForceShowVerticalMenu] = useState(false);

    // Listen for page section changes
    useEffect(() => {
        let timeout;
        const handleSectionChange = (e) => {
            const { activeSection, category } = e.detail;
            setActivePageSection({ category, index: activeSection });

            // Show menu temporarily on change
            setForceShowVerticalMenu(true);
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => setForceShowVerticalMenu(false), 3000);
        };
        window.addEventListener('page-section-changed', handleSectionChange);
        return () => {
            window.removeEventListener('page-section-changed', handleSectionChange);
            if (timeout) clearTimeout(timeout);
        };
    }, []);

    if (!user) return null;

    const isAdmin = user.role === 'admin' || user.role === 'operator';

    const menuItems = useMemo(() => {
        const items = isAdmin ? [
            { icon: LayoutDashboard, label: 'Board', path: '/admin/dashboard' },
            { icon: DollarSign, label: 'Finanzas', path: '/admin/finance' },
            { icon: BarChart3, label: 'Ventas', path: '/admin/sales' },
            { icon: Megaphone, label: 'Marketing', path: '/admin/marketing' },
            { icon: Package, label: 'Fulfillment', path: '/admin/fulfillment' },
            { divider: true },
            { icon: Database, label: 'Bases', path: '/admin/database' },
        ] : (user.role === 'setter') ? [
            { icon: BarChart3, label: 'Ventas', path: '/setter/dashboard' },
        ] : [
            {
                icon: LayoutDashboard,
                label: 'Board',
                path: '/closer/dashboard',
                sections: ['Bienvenida', 'Reporte']
            },
            {
                icon: Database,
                label: 'Leads',
                path: '/closer/leads',
                sections: ['Pipeline', 'Tabla']
            },
            {
                icon: BarChart3,
                label: 'Estadísticas',
                path: '/closer/statistics'
            },
        ];
        return items;
    }, [isAdmin, user.role]);

    const userActions = useMemo(() => [
        { icon: Settings, label: 'CONFIG', onClick: () => { onSettingsClick(); setShowUserMenu(false); } },
        { icon: LogOut, label: 'SALIR', onClick: logout, color: 'text-red-500' }
    ], [onSettingsClick, logout]);

    const activeItem = useMemo(() => menuItems.find(i => i.path === location.pathname) || menuItems[0], [menuItems, location.pathname]);
    const itemsForMenu = useMemo(() => menuItems.filter(i => !i.divider), [menuItems]);

    const handleSectionRequest = (index) => {
        window.dispatchEvent(new CustomEvent('request-section-change', { detail: { index } }));
    };

    // Unified Keyboard Logic
    useEffect(() => {
        const handleKeys = (e) => {
            if (!isVisible) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

            const actionableItems = itemsForMenu;
            const cycle = [...actionableItems, { id: 'USER', label: 'USER' }];

            // Current position
            let currentIndex = -1;
            if (showUserMenu) {
                currentIndex = cycle.length - 1;
            } else {
                currentIndex = cycle.findIndex(i => i.path === location.pathname);
            }

            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                if (currentIndex === -1) return;

                let nextIndex;
                if (e.key === 'ArrowRight') {
                    nextIndex = (currentIndex + 1) % cycle.length;
                } else {
                    nextIndex = (currentIndex - 1 + cycle.length) % cycle.length;
                }

                const target = cycle[nextIndex];
                if (target.id === 'USER') {
                    setShowUserMenu(true);
                } else {
                    setShowUserMenu(false);
                    navigate(target.path);
                }
            }

            // Internal User Menu Nav
            if (showUserMenu) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setUserMenuIdx(prev => (prev + 1) % userActions.length);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setUserMenuIdx(prev => (prev - 1 + userActions.length) % userActions.length);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    userActions[userMenuIdx].onClick();
                } else if (e.key === 'Escape') {
                    setShowUserMenu(false);
                }
            }
        };

        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [menuItems, userActions, showUserMenu, userMenuIdx, location.pathname, navigate, itemsForMenu, isVisible]);

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4">
            <AnimatePresence>
                {isVisible ? (
                    <motion.div
                        layout
                        initial={{ y: 100, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 100, opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="glass-panel p-1.5 flex items-center gap-1 shadow-2xl border-white/20 select-none"
                    >
                        <div className="flex items-center gap-1 px-1">
                            {menuItems.map((item, idx) => (
                                item.divider ? (
                                    <DockDivider key={`div-${idx}`} />
                                ) : (
                                    <DockItem
                                        key={item.path || item.id || item.label}
                                        {...item}
                                        active={location.pathname === item.path}
                                        activeSub={activePageSection.index}
                                        onSectionClick={handleSectionRequest}
                                        forceShowSubMenu={item.label === activePageSection.category && forceShowVerticalMenu}
                                    />
                                )
                            ))}
                        </div>

                        <DockDivider />

                        <div className="flex items-center gap-1 px-1 relative h-full">
                            {/* User Menu Trigger */}
                            <div
                                className="relative h-full flex items-center"
                                onMouseEnter={() => setShowUserMenu(true)}
                                onMouseLeave={() => setShowUserMenu(false)}
                            >
                                <motion.button
                                    layout
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className={`
                                        h-11 rounded-2xl flex items-center gap-2 text-white font-black text-base shadow-lg transition-all duration-300 px-1
                                        ${showUserMenu ? 'bg-primary shadow-primary/40 px-4' : 'bg-primary/80 hover:bg-primary px-1 shadow-primary/20'}
                                    `}
                                >
                                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                                        {user.username[0].toUpperCase()}
                                    </div>

                                    <AnimatePresence>
                                        {showUserMenu && (
                                            <motion.span
                                                initial={{ opacity: 0, width: 0 }}
                                                animate={{ opacity: 1, width: 'auto' }}
                                                exit={{ opacity: 0, width: 0 }}
                                                className="text-[10px] uppercase tracking-widest whitespace-nowrap overflow-hidden pr-1 font-semibold"
                                            >
                                                {user.username}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </motion.button>

                                <AnimatePresence>
                                    {showUserMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute bottom-full right-0 mb-3 p-1 glass-panel shadow-2xl divide-y divide-white/5 overflow-hidden backdrop-blur-3xl border-white/20 min-w-[150px]"
                                        >
                                            <div className="p-0.5 flex flex-col gap-0.5">
                                                {userActions.map((action, idx) => (
                                                    <button
                                                        key={action.label}
                                                        onClick={action.onClick}
                                                        className={`
                                                            flex items-center justify-center gap-2 w-full px-2 py-3 rounded-xl transition-all group relative
                                                            ${userMenuIdx === idx ? 'bg-primary text-white' : 'hover:bg-primary/10 text-main'}
                                                        `}
                                                    >
                                                        <action.icon
                                                            size={14}
                                                            className={`
                                                                ${userMenuIdx === idx ? 'text-white' : (action.color || 'text-muted')} 
                                                                transition-colors
                                                            `}
                                                        />
                                                        <span className="text-[9px] uppercase tracking-tighter font-light">{action.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.button
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        onClick={onToggleVisibility}
                        className="group flex flex-col items-center gap-1.5 focus:outline-none"
                    >
                        <div className="px-5 py-1.5 glass-panel shadow-2xl border-white/10 hover:bg-white/20 transition-all rounded-t-2xl rounded-b-md flex flex-col items-center animate-in slide-in-from-bottom-2 duration-500">
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted group-hover:text-primary transition-colors">Menú</span>
                            <div className="text-primary animate-bounce">
                                <ChevronUp size={16} strokeWidth={3} />
                            </div>
                        </div>
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Dock;
