import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import BugReportChat from './BugReportChat';
import BugReportHistory from './BugReportHistory';
import { BUG_REPORT_EVENT, BUG_REPORT_VISTA_EVENT, publicarEstadoDeReportes } from '../../utils/bugReportBus';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// Orquestador global del reporte de bugs: el chat, «Mis reportes» y el disparador reactivo. Desde el
// 07/10/2026 NO dibuja el botón flotante rosado: «Reportar un problema» y «Mis reportes» son opciones
// del menú de sesión que abre el avatar del dock (`MenuSesion`), que le pide a este componente que
// abra una vista con BUG_REPORT_VISTA_EVENT y lee de acá, por el bus (`publicarEstadoDeReportes`), cuántas
// respuestas hay sin leer y si quedó un reporte en progreso. Se monta a nivel de App
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
    const [view, setView] = useState('closed'); // 'closed' | 'chat' | 'minimized' | 'history'
    const [technicalContext, setTechnicalContext] = useState(null);
    const [pendingPrompt, setPendingPrompt] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    // La vista de ahora para los listeners de eventos, que no deben re-suscribirse en cada cambio.
    const viewRef = useRef(view);
    useEffect(() => { viewRef.current = view; }, [view]);

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

    // El menú del usuario pide abrir una vista. «chat» retoma el reporte en progreso si lo hay (el
    // contexto técnico y el estado del chat siguen vivos) y si no, abre uno nuevo.
    useEffect(() => {
        if (!user) return;
        const alPedirVista = (e) => {
            const vista = e.detail?.vista;
            if (vista === 'historial') {
                setUnreadCount(0);
                setView('history');
            } else if (vista === 'chat') {
                if (viewRef.current !== 'minimized') setTechnicalContext(null);
                setView('chat');
            }
        };
        window.addEventListener(BUG_REPORT_VISTA_EVENT, alPedirVista);
        return () => window.removeEventListener(BUG_REPORT_VISTA_EVENT, alPedirVista);
    }, [user]);

    // Lo que ve el menú: respuestas sin leer y si hay un reporte a medias.
    useEffect(() => {
        publicarEstadoDeReportes({ sinLeer: unreadCount, enProgreso: view === 'minimized' });
    }, [unreadCount, view]);

    // Fetch pasivo (solo la lista, nunca abre un hilo) para saber si hay mensajes nuevos y
    // mostrar la cuenta sobre el avatar del dock — se consume de verdad al abrir "Mis reportes"
    // y entrar a la conversación (GET /bug-reports/<id>/messages marca la lectura ahí).
    // Antes solo se pedía una vez al montar (con el login) — si te respondían mientras ya
    // tenías la app abierta, el badge no aparecía hasta recargar. El poll cada 45s lo detecta
    // sin que el usuario tenga que hacer nada.
    useEffect(() => {
        if (!user) return;
        const cargarNoLeidos = () => {
            api.get('/bug-reports/mine', { skipBugReport: true })
                .then(res => {
                    const unread = res.data.filter(r => r.unread_for_user).length;
                    setUnreadCount(unread);
                })
                .catch(() => { });
        };
        cargarNoLeidos();
        const interval = setInterval(cargarNoLeidos, 45000);
        return () => clearInterval(interval);
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

            <BugReportChat
                isOpen={view === 'chat'}
                onClose={() => setView('closed')}
                onMinimize={() => setView('minimized')}
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
