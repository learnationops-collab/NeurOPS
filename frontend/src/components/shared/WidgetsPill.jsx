import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
    Moon,
    Sun,
    Flame,
    Maximize2,
    MinusSquare,
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
    const { theme, setTheme, variant, setVariant, themes } = useTheme();
    const { user } = useAuth();
    const [selectedIdx, setSelectedIdx] = useState(0);

    const isAdmin = user?.role === 'admin' || user?.role === 'operator';
    const isImpersonating = user?.is_impersonating;

    const cycleTheme = () => {
        const ids = Object.keys(themes);
        const currentIndex = ids.indexOf(theme);
        const nextIndex = (currentIndex + 1) % ids.length;
        setTheme(ids[nextIndex]);
    };

    const toggleVariant = () => {
        setVariant(variant === 'glass' ? 'solid' : 'glass');
    };

    // Define actions for keyboard navigation
    const actions = useMemo(() => {
        const base = [
            { id: 'theme', label: 'TEMA', action: cycleTheme },
            { id: 'variant', label: 'MODO', action: toggleVariant },
        ];
        if (isAdmin) {
            base.push({ id: 'console', label: 'DEBUG', action: onConsoleToggle });
        }
        base.push({ id: 'impersonate', label: 'SIMULACIÓN', action: onImpersonateClick });
        return base;
    }, [isAdmin, theme, variant, onConsoleToggle, onImpersonateClick, themes, setTheme, setVariant]);

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
                        {/* Theme Cycle */}
                        <button
                            onClick={cycleTheme}
                            onMouseEnter={() => setSelectedIdx(0)}
                            className={`p-3 rounded-2xl transition-all text-main group relative ${selectedIdx === 0 ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/10'}`}
                        >
                            {theme === 'dark' ? <Moon size={20} /> : theme === 'light' ? <Sun size={20} /> : <Flame size={20} />}
                            <span className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-surface border border-base px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                                {themes[theme]?.name}
                            </span>
                        </button>

                        {/* Glass/Solid Toggle */}
                        <button
                            onClick={toggleVariant}
                            onMouseEnter={() => setSelectedIdx(1)}
                            className={`p-3 rounded-2xl transition-all text-main group relative ${selectedIdx === 1 ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/10'}`}
                        >
                            {variant === 'glass' ? <Maximize2 size={20} /> : <MinusSquare size={20} />}
                            <span className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-surface border border-base px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                                MODO: {variant?.toUpperCase()}
                            </span>
                        </button>

                        <div className="w-px h-6 bg-white/10 mx-1" />

                        {/* Console (Admin/Operator) */}
                        {isAdmin && (
                            <button
                                onClick={onConsoleToggle}
                                onMouseEnter={() => setSelectedIdx(2)}
                                className={`p-3 rounded-2xl transition-all group relative ${isConsoleOpen || selectedIdx === 2 ? 'bg-primary text-white shadow-lg' : 'text-main hover:bg-white/10'}`}
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
                            onMouseEnter={() => setSelectedIdx(isAdmin ? 3 : 2)}
                            className={`p-3 rounded-2xl transition-all group relative ${isImpersonating || (isAdmin ? selectedIdx === 3 : selectedIdx === 2) ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-main hover:bg-white/10'}`}
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
