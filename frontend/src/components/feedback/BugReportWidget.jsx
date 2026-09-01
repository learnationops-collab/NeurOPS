import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, AlertTriangle, X } from 'lucide-react';
import BugReportChat from './BugReportChat';
import { BUG_REPORT_EVENT } from '../../utils/bugReportBus';

// Botón flotante global + orquestador del disparador reactivo. Vive en MainLayout, así
// que solo se monta para usuarios autenticados. El interceptor de axios (api.js) dispara
// BUG_REPORT_EVENT en cada error 5xx/red sin abrir el chat directamente (sería intrusivo
// en llamadas de fondo); en vez de eso muestra este mini-prompt tipo toast con el botón
// "Reportar error" secundario. ErrorBoundary dispara el mismo evento con autoOpen:true
// porque ahí sí hay una acción explícita del usuario sobre un fallo visible en pantalla.
const BugReportWidget = () => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [technicalContext, setTechnicalContext] = useState(null);
    const [pendingPrompt, setPendingPrompt] = useState(null);

    useEffect(() => {
        const handleTrigger = (e) => {
            const context = e.detail || {};
            if (context.autoOpen) {
                setTechnicalContext(context);
                setIsChatOpen(true);
            } else {
                setPendingPrompt(context);
            }
        };
        window.addEventListener(BUG_REPORT_EVENT, handleTrigger);
        return () => window.removeEventListener(BUG_REPORT_EVENT, handleTrigger);
    }, []);

    useEffect(() => {
        if (!pendingPrompt) return;
        const timer = setTimeout(() => setPendingPrompt(null), 10000);
        return () => clearTimeout(timer);
    }, [pendingPrompt]);

    const openFromPrompt = () => {
        setTechnicalContext(pendingPrompt);
        setPendingPrompt(null);
        setIsChatOpen(true);
    };

    const openManually = () => {
        setTechnicalContext(null);
        setIsChatOpen(true);
    };

    return (
        <>
            <AnimatePresence>
                {pendingPrompt && !isChatOpen && (
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

            {!isChatOpen && (
                <button
                    data-bug-report-ignore="true"
                    onClick={openManually}
                    className="fixed bottom-8 right-24 z-[190] w-12 h-12 rounded-full bg-surface border border-base shadow-2xl flex items-center justify-center text-muted hover:text-primary hover:border-primary transition-all active:scale-95"
                    title="Reportar un problema o feedback"
                >
                    <Bug size={20} />
                </button>
            )}

            <BugReportChat
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                technicalContext={technicalContext}
            />
        </>
    );
};

export default BugReportWidget;
