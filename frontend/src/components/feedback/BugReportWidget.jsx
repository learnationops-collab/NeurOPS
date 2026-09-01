import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, AlertTriangle, X, History } from 'lucide-react';
import BugReportChat from './BugReportChat';
import BugReportHistory from './BugReportHistory';
import { BUG_REPORT_EVENT } from '../../utils/bugReportBus';
import api from '../../services/api';

// Botón flotante global + orquestador del disparador reactivo. Vive en MainLayout, así
// que solo se monta para usuarios autenticados. El interceptor de axios (api.js) dispara
// BUG_REPORT_EVENT en cada error 5xx/red sin abrir el chat directamente (sería intrusivo
// en llamadas de fondo); en vez de eso muestra este mini-prompt tipo toast con el botón
// "Reportar error" secundario. ErrorBoundary dispara el mismo evento con autoOpen:true
// porque ahí sí hay una acción explícita del usuario sobre un fallo visible en pantalla.
const BugReportWidget = () => {
    const [view, setView] = useState('closed'); // 'closed' | 'chat' | 'history'
    const [technicalContext, setTechnicalContext] = useState(null);
    const [pendingPrompt, setPendingPrompt] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
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
    }, []);

    // Fetch pasivo (sin mark_read) solo para saber si hay respuestas nuevas y mostrar el
    // badge en el botón flotante — se consume de verdad al abrir "Mis reportes".
    useEffect(() => {
        api.get('/bug-reports/mine', { skipBugReport: true })
            .then(res => {
                const unread = res.data.filter(r => r.admin_response && !r.is_read_by_user).length;
                setUnreadCount(unread);
            })
            .catch(() => { });
    }, []);

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
                <div data-bug-report-ignore="true" className="fixed bottom-8 right-24 z-[190] flex flex-col items-center gap-2">
                    <button
                        onClick={openHistory}
                        className="relative w-9 h-9 rounded-full bg-surface border border-base shadow-lg flex items-center justify-center text-muted hover:text-primary hover:border-primary transition-all active:scale-95"
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
                        className="w-12 h-12 rounded-full bg-surface border border-base shadow-2xl flex items-center justify-center text-muted hover:text-primary hover:border-primary transition-all active:scale-95"
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
