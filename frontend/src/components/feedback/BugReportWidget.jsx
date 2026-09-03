import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, AlertTriangle, X, History } from 'lucide-react';
import BugReportChat from './BugReportChat';
import BugReportHistory from './BugReportHistory';
import { BUG_REPORT_EVENT } from '../../utils/bugReportBus';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// Botón flotante global + orquestador del disparador reactivo. Se monta a nivel de App
// (no dentro de MainLayout) porque no todas las vistas autenticadas usan MainLayout —
// CloserWorkflowPage ("/closer/deck", donde los closers pasan todo su tiempo) corre
// standalone a propósito, y montarlo solo en MainLayout dejaba a los closers sin forma
// de reportar bugs. Se autogatea con useAuth() en vez de depender del layout padre.
// El interceptor de axios (api.js) dispara BUG_REPORT_EVENT en cada error 5xx/red sin
// abrir el chat directamente (sería intrusivo en llamadas de fondo); en vez de eso
// muestra este mini-prompt tipo toast con el botón "Reportar error" secundario.
// ErrorBoundary dispara el mismo evento con autoOpen:true porque ahí sí hay una acción
// explícita del usuario sobre un fallo visible en pantalla.
const BugReportWidget = () => {
    const { user } = useAuth();
    const [view, setView] = useState('closed'); // 'closed' | 'chat' | 'history'
    const [technicalContext, setTechnicalContext] = useState(null);
    const [pendingPrompt, setPendingPrompt] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        const handleTrigger = (e) => {
            const context = e.detail || {};
            if (context.autoOpen) {
                setTechnicalContext(context);
                setView('chat');
            } else {
                setPendingPrompt(context);
            }
        };
        window.addEventListener(BUG_REPORT_EVENT, handleTrigger);
        return () => window.removeEventListener(BUG_REPORT_EVENT, handleTrigger);
    }, [user]);

    // Fetch pasivo (solo la lista, nunca abre un hilo) para saber si hay mensajes nuevos y
    // mostrar el badge en el botón flotante — se consume de verdad al abrir "Mis reportes"
    // y entrar a la conversación (GET /bug-reports/<id>/messages marca la lectura ahí).
    useEffect(() => {
        if (!user) return;
        api.get('/bug-reports/mine', { skipBugReport: true })
            .then(res => {
                const unread = res.data.filter(r => r.unread_for_user).length;
                setUnreadCount(unread);
            })
            .catch(() => { });
    }, [user]);

    useEffect(() => {
        if (!pendingPrompt) return;
        const timer = setTimeout(() => setPendingPrompt(null), 10000);
        return () => clearTimeout(timer);
    }, [pendingPrompt]);

    const openFromPrompt = () => {
        setTechnicalContext(pendingPrompt);
        setPendingPrompt(null);
        setView('chat');
    };

    const openManually = () => {
        setTechnicalContext(null);
        setView('chat');
    };

    const openHistory = () => {
        setUnreadCount(0);
        setView('history');
    };

    if (!user) return null;

    return (
        <>
            <AnimatePresence>
                {pendingPrompt && view === 'closed' && (
                    <motion.div
                        data-bug-report-ignore="true"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-8 right-24 z-[200] glass-panel rounded-2xl shadow-2xl p-4 flex items-center gap-3 max-w-xs"
                    >
                        <AlertTriangle size={18} className="text-orange-500 shrink-0" />
                        <div className="flex-1 text-xs">
                            <p className="font-bold">Algo falló en la última acción</p>
                            <p className="text-muted">¿Quieres reportarlo?</p>
                        </div>
                        <button
                            onClick={openFromPrompt}
                            className="bg-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-xl px-3 py-2 active:scale-95 transition-all shrink-0"
                        >
                            Reportar
                        </button>
                        <button
                            onClick={() => setPendingPrompt(null)}
                            className="text-muted hover:text-base p-1 shrink-0"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {view === 'closed' && (
                // "group" cubre el bug y el historial (incluido el espacio entre ambos): el
                // historial aparece al entrar el puntero a esta zona, que en la práctica significa
                // pasar por encima del ícono del bug (es el único visible antes del hover, y el
                // historial ocupa el lugar justo arriba de él). Evita el parpadeo que daría usar
                // "peer" con hover exclusivo del botón del bug: al mover el cursor hacia el
                // historial recién revelado, cruzar el espacio entre ambos apagaría el hover antes
                // de llegar a poder hacer clic.
                <div data-bug-report-ignore="true" className="group fixed bottom-8 right-24 z-[190] flex flex-col items-center gap-2">
                    <button
                        onClick={openHistory}
                        className="relative w-9 h-9 rounded-full bg-surface border border-base shadow-lg flex items-center justify-center text-muted hover:text-primary hover:border-primary transition-all active:scale-95 opacity-0 -translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto"
                        title="Mis reportes"
                    >
                        <History size={16} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={openManually}
                        // Rosado fijo de marca (#FF3FA4, ver --brand-secondary/--v6-pink en index.css) en vez
                        // de bg-primary/bg-secondary: esos tokens cambian de color según el tema elegido
                        // (azul, índigo, custom...), y este botón necesita quedar siempre rosado y llamativo
                        // sin importar el tema activo — a diferencia del resto de la UI, que sí debe seguirlo.
                        className="w-12 h-12 rounded-full bg-[#FF3FA4] shadow-2xl shadow-[#FF3FA4]/50 flex items-center justify-center text-white hover:bg-[#FF6AD5] hover:shadow-[#FF3FA4]/70 hover:scale-105 transition-all active:scale-95"
                        title="Reportar un problema o feedback"
                    >
                        <Bug size={20} />
                    </button>
                </div>
            )}

            <BugReportChat
                isOpen={view === 'chat'}
                onClose={() => setView('closed')}
                technicalContext={technicalContext}
            />

            <BugReportHistory
                isOpen={view === 'history'}
                onClose={() => setView('closed')}
            />
        </>
    );
};

export default BugReportWidget;
