import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../context/ThemeContext';
import DebugConsole from './modals/DebugConsole';
import OnboardingTour from './modals/OnboardingTour';
import OperatorControls from './modals/OperatorControls';
import GlobalSettingsModal from './modals/GlobalSettingsModal';
import Dock from './shared/Dock';
import WidgetsPill from './shared/WidgetsPill';
import HotkeysManager from './admin/HotkeysManager';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Loader2, ChevronRight } from 'lucide-react';
import api from '../services/api';

const MainLayout = ({ children }) => {
    const { user } = useAuth();
    const { backgroundType, customBackground, stockBackground } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const [showImpersonation, setShowImpersonation] = useState(false);
    const [showConsole, setShowConsole] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isPillOpen, setIsPillOpen] = useState(false);
    const [isDockVisible, setIsDockVisible] = useState(true);
    const [lastWidgetsNavKey, setLastWidgetsNavKey] = useState(null);

    // Estados para notificaciones globales
    const [notifications, setNotifications] = useState([]);
    const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);
    const [loadingNotifs, setLoadingNotifs] = useState(false);

    const inactivityTimerRef = useRef(null);

    // Obtener notificaciones
    const fetchNotifications = useCallback(async () => {
        if (!user || !['closer', 'setter', 'admin'].includes(user.role)) return;
        
        try {
            const rolePath = user.role === 'closer' ? 'closer' : user.role === 'setter' ? 'setter' : 'admin';
            const res = await api.get(`/${rolePath}/notifications`);
            setNotifications(res.data || []);
        } catch (err) {
            console.error("Error al cargar notificaciones globales:", err);
        }
    }, [user]);

    // Polling inteligente cada 30 segundos
    useEffect(() => {
        fetchNotifications();
        
        const interval = setInterval(() => {
            fetchNotifications();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Conteo de no leídas
    const unreadCount = notifications.filter(n => !n.is_read).length;

    // Acción de click en notificación
    const handleNotificationClick = async (noti) => {
        const rolePath = user.role === 'closer' ? 'closer' : user.role === 'setter' ? 'setter' : 'admin';
        
        if (!noti.is_read) {
            try {
                await api.post(`/${rolePath}/notifications/${noti.id}/read`);
                setNotifications(prev => prev.filter(n => n.id !== noti.id));
            } catch (err) {
                console.error("Error al marcar notificación como leída:", err);
            }
        }
        
        if (noti.associated_id) {
            navigate(`/${rolePath}/deck?appt_id=${noti.associated_id}`);
        }
        
        setShowNotificationsDrawer(false);
    };

    // Formato de tiempo relativo simplificado
    const formatTimeRelative = (isoStr) => {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            const now = new Date();
            const diffMs = now - d;
            const diffMin = Math.floor(diffMs / 60000);
            
            if (diffMin < 1) return 'Hace un momento';
            if (diffMin < 60) return `Hace ${diffMin} min`;
            
            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return `Hace ${diffHr} h`;
            
            return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        } catch (e) {
            return '';
        }
    };

    const resetInactivity = useCallback(() => {
        setIsDockVisible(true);
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

        inactivityTimerRef.current = setTimeout(() => {
            setIsDockVisible(false);
        }, 5000); // 5 seconds
    }, []);

    useEffect(() => {
        const handleActivity = () => resetInactivity();

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('mousedown', handleActivity);
        window.addEventListener('scroll', handleActivity, true);

        resetInactivity();

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('mousedown', handleActivity);
            window.removeEventListener('scroll', handleActivity, true);
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
    }, [resetInactivity]);

    useEffect(() => {
        const handleDoubleClick = () => {
            if (isPillOpen) setIsPillOpen(false);
            if (showSettings) setShowSettings(false);
            if (showConsole) setShowConsole(false);
            if (showImpersonation) setShowImpersonation(false);
        };

        window.addEventListener('dblclick', handleDoubleClick);
        return () => window.removeEventListener('dblclick', handleDoubleClick);
    }, [isPillOpen, showSettings, showConsole, showImpersonation]);

    const controlFocus = isPillOpen ? 'widgets' : 'dock';

    useEffect(() => {
        if (isPillOpen) {
            setIsDockVisible(false);
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        } else {
            resetInactivity();
        }
    }, [isPillOpen, resetInactivity]);

    if (!user) return null;

    const bgImage = backgroundType === 'custom' ? customBackground : backgroundType === 'stock' ? stockBackground : null;

    return (
        <div
            className="flex h-screen bg-main text-base overflow-hidden w-full relative transition-all duration-1000"
            style={bgImage ? {
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            } : {}}
        >
            {bgImage && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
            )}

            <div className="relative z-10 flex w-full h-full overflow-hidden">
                <HotkeysManager
                    controlFocus={controlFocus}
                    onToggleWidgets={() => setIsPillOpen(prev => !prev)}
                    onToggleSettings={() => setShowSettings(prev => !prev)}
                    onResetInactivity={resetInactivity}
                    onWidgetsNavigate={(key) => setLastWidgetsNavKey({ key, timestamp: Date.now() })}
                />

                <OperatorControls
                    isOpen={showImpersonation}
                    onClose={() => setShowImpersonation(false)}
                />

                <GlobalSettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                />

                <OnboardingTour />

                <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                    <div id="app-main-scroll" className="flex-1 overflow-y-auto scroll-smooth pb-32">
                        <div className="min-h-full">
                            {children}
                        </div>
                    </div>

                    <Dock
                        isVisible={isDockVisible}
                        onToggleVisibility={() => setIsDockVisible(!isDockVisible)}
                        onSettingsClick={() => setShowSettings(true)}
                        isSettingsOpen={showSettings}
                        unreadNotificationsCount={unreadCount}
                        onNotificationsClick={() => setShowNotificationsDrawer(true)}
                    />

                    <WidgetsPill
                        isOpen={isPillOpen}
                        onToggle={() => setIsPillOpen(!isPillOpen)}
                        onConsoleToggle={() => setShowConsole(!showConsole)}
                        onImpersonateClick={() => setShowImpersonation(true)}
                        isConsoleOpen={showConsole}
                        lastNavKey={lastWidgetsNavKey}
                    />
                </main>

                <DebugConsole isVisible={showConsole} onClose={() => setShowConsole(false)} />
            </div>

            {/* Drawer Lateral de Notificaciones Premium */}
            <AnimatePresence>
                {showNotificationsDrawer && (
                    <>
                        {/* Backdrop de desenfoque */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowNotificationsDrawer(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-50 pointer-events-auto"
                        />

                        {/* Contenedor del Panel */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 26, stiffness: 190 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-[400px] bg-[#101117]/95 backdrop-blur-3xl border-l border-white/5 z-[60] p-6 flex flex-col shadow-2xl pointer-events-auto text-left"
                        >
                            {/* Header del Drawer */}
                            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6">
                                <div className="space-y-1">
                                    <h2 className="text-md font-black text-white uppercase tracking-widest flex items-center gap-2">
                                        <Bell className="text-[#1534ff]" size={18} />
                                        Bandeja de Leads
                                    </h2>
                                    <p className="text-[9px] font-bold text-muted uppercase tracking-widest">
                                        Comentarios y actualizaciones
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowNotificationsDrawer(false)}
                                    className="p-2 hover:bg-white/5 rounded-2xl transition-all text-muted hover:text-white"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Contenido/Lista de Notificaciones */}
                            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3.5">
                                {loadingNotifs ? (
                                    <div className="flex justify-center items-center h-48">
                                        <Loader2 className="animate-spin text-[#1534ff]" size={24} />
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-center">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted mb-4 opacity-40">
                                            <Bell size={20} />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            Sin comentarios nuevos
                                        </p>
                                    </div>
                                ) : (
                                    notifications.map(noti => (
                                        <div
                                            key={noti.id}
                                            onClick={() => handleNotificationClick(noti)}
                                            className={`p-4 border rounded-2xl hover:bg-white/5 transition-all cursor-pointer space-y-2 group relative overflow-hidden ${
                                                !noti.is_read
                                                    ? 'bg-[#1534ff]/5 border-[#1534ff]/20'
                                                    : 'bg-[#1a1c23]/30 border-white/5'
                                            }`}
                                        >
                                            {/* Indicador no leído */}
                                            {!noti.is_read && (
                                                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#1534ff]" />
                                            )}

                                            <div className="flex justify-between items-start gap-4">
                                                <h3 className="text-xs font-black text-white group-hover:text-[#1534ff] transition-colors leading-tight pr-3">
                                                    {noti.subject}
                                                </h3>
                                                <span className="text-[8px] font-bold text-slate-500 whitespace-nowrap">
                                                    {formatTimeRelative(noti.created_at)}
                                                </span>
                                            </div>
                                            
                                            <p className="text-[11px] text-slate-400 font-medium leading-normal italic line-clamp-2">
                                                {noti.content}
                                            </p>
                                            
                                            <div className="flex items-center gap-1.5 pt-1 text-[9px] font-black uppercase text-[#1534ff] tracking-wider">
                                                <span>Ir al lead</span>
                                                <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MainLayout;
