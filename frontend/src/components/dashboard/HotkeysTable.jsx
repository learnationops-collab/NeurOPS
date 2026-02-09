import React from 'react';
import { motion } from 'framer-motion';
import { Keyboard, ArrowLeftRight, ArrowUpDown, Settings } from 'lucide-react';
import Card from '../ui/Card';
import { useAuth } from '../../contexts/AuthContext';

const HotkeysTable = () => {
    const { user } = useAuth();
    const isCloser = user?.role === 'closer';

    const hotkeys = [
        { key: '← / →', description: 'Cambiar entre páginas (Dashboard, Leads, etc.)', icon: ArrowLeftRight },
        { key: '↑ / ↓', description: 'Navegar entre secciones (Dashboard / Resumen)', icon: ArrowUpDown },
        { key: 'C', description: 'Abrir Ajustes / Configuración', icon: Settings },
        ...(isCloser ? [{ key: 'L', description: 'Mi Link de Agenda', icon: Keyboard }] : []),
    ];

    return (
        <Card variant="surface" className="p-6 bg-surface/30 backdrop-blur-md border border-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                <div className="p-2 bg-primary/20 rounded-xl">
                    <Keyboard size={18} className="text-primary" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Atajos de Teclado</h3>
            </div>

            <div className="space-y-4">
                {hotkeys.map((hk, idx) => (
                    <motion.div
                        key={hk.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="px-2.5 py-1.5 bg-main border border-base rounded-lg shadow-inner min-w-[50px] text-center">
                                <span className="text-[10px] font-black text-primary font-mono">{hk.key}</span>
                            </div>
                            <span className="text-[11px] font-bold text-muted group-hover:text-base transition-colors">
                                {hk.description}
                            </span>
                        </div>
                        <hk.icon size={12} className="text-muted/20 group-hover:text-primary/40 transition-colors" />
                    </motion.div>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/5">
                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted/30 text-center italic">
                    Navegación NeurOPS Pro
                </p>
            </div>
        </Card>
    );
};

export default HotkeysTable;
