import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SettingsPage from '../pages/admin/settings/SettingsPage';
import CloserSettingsPage from '../pages/closer/settings/SettingsPage';

const GlobalSettingsModal = ({ isOpen, onClose }) => {
    const { user } = useAuth();

    if (!user) return null;

    const isAdmin = user.role === 'admin' || user.role === 'operator';

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 40 }}
                        className="fixed inset-4 md:inset-10 z-[101] glass-effect rounded-[3rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-8 border-b border-white/5 bg-white/5 backdrop-blur-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
                                    <Settings size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter">Panel de Configuración</h2>
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Gestión de cuenta y preferencias del sistema</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-4 hover:bg-white/10 rounded-2xl text-muted hover:text-base transition-all active:scale-95"
                            >
                                <X size={28} />
                            </button>
                        </div>

                        {/* Content Area - Scrollable */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-main/20">
                            {isAdmin ? <SettingsPage /> : <CloserSettingsPage />}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default GlobalSettingsModal;
