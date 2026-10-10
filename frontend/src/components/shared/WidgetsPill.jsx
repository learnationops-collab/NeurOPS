import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import {
    Terminal,
    Ghost,
    ChevronRight,
    Settings
} from 'lucide-react';

const WidgetsPill = ({
    isOpen,
    onToggle,
    onConsoleToggle,
    onImpersonateClick,
    isConsoleOpen,
    lastNavKey // Received from MainLayout
}) => {
    const { user } = useAuth();
    const [selectedIdx, setSelectedIdx] = useState(0);

    const isAdmin = user?.role === 'admin' || user?.role === 'operator';
    const isImpersonating = user?.is_impersonating;

    // El tema y el modo se eligen en Configuración › Apariencia (temas/TabApariencia.jsx).
    // Define actions for keyboard navigation
    const actions = useMemo(() => {
        const base = [];
        if (isAdmin) {
            base.push({ id: 'console', label: 'DEBUG', action: onConsoleToggle });
        }
        base.push({ id: 'impersonate', label: 'SIMULACIÓN', action: onImpersonateClick });
        return base;
    }, [isAdmin, onConsoleToggle, onImpersonateClick]);

    // Handle navigation when prop changes
    useEffect(() => {
        if (!isOpen || !lastNavKey) return;

        const { key } = lastNavKey;
        if (key === 'arrowright') {
            setSelectedIdx(prev => (prev + 1) % actions.length);
        } else if (key === 'arrowleft') {
            setSelectedIdx(prev => (prev - 1 + actions.length) % actions.length);
        } else if (key === 'enter') {
            actions[selectedIdx].action();
        }
    }, [lastNavKey, isOpen, actions, selectedIdx]);

    if (!user) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-24 right-8 z-[60] flex items-end gap-3 pointer-events-none select-none"
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        className="glass-panel p-2 flex items-center gap-1 shadow-2xl pointer-events-auto"
                    >
                        {/* Console (Admin/Operator) */}
                        {isAdmin && (
                            <button
                                onClick={onConsoleToggle}
                                onMouseEnter={() => setSelectedIdx(0)}
                                className={`p-3 rounded-2xl transition-all group relative ${isConsoleOpen || selectedIdx === 0 ? 'bg-primary text-white shadow-lg' : 'text-main hover:bg-white/10'}`}
                            >
                                <Terminal size={20} />
                                <span className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-surface border border-base px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                                    TERMINAL DEBUG
                                </span>
                            </button>
                        )}

                        {/* Simulation */}
                        <button
                            onClick={onImpersonateClick}
                            onMouseEnter={() => setSelectedIdx(isAdmin ? 1 : 0)}
                            className={`p-3 rounded-2xl transition-all group relative ${isImpersonating || (isAdmin ? selectedIdx === 1 : selectedIdx === 0) ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-main hover:bg-white/10'}`}
                        >
                            <Ghost size={20} className={isImpersonating ? "animate-pulse" : ""} />
                            <span className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-surface border border-base px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                                {isImpersonating ? 'DETENER SIMULACIÓN' : 'SIMULAR ACCESO'}
                            </span>
                        </button>
                    </motion.div>

                    <button
                        onClick={onToggle}
                        className="p-4 rounded-full shadow-2xl transition-all pointer-events-auto border border-white/10 bg-white text-black rotate-90 scale-90"
                    >
                        <ChevronRight size={24} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default WidgetsPill;
