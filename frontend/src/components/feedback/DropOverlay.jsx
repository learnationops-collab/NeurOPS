import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ImagePlus } from 'lucide-react';

// Aviso de "soltá la imagen acá" sobre el chat de reportes mientras se arrastra un archivo.
const DropOverlay = ({ visible }) => {
    const reducido = useReducedMotion();
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="soltar-imagen"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    // `--color-surface` ya es translúcido: el desenfoque evita que el
                    // texto del chat se lea por detrás del aviso y compita con él.
                    className="pointer-events-none absolute inset-0 z-10 p-3 flex bg-surface backdrop-blur-md"
                >
                    <motion.div
                        initial={reducido ? false : { scale: 0.94, y: 8 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
                        className="flex-1 rounded-[1.6rem] border-2 border-dashed border-[#FF3FA4] flex flex-col items-center justify-center gap-2 text-center p-6"
                    >
                        <motion.span
                            animate={reducido ? undefined : { y: [0, -4, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                            className="w-12 h-12 rounded-2xl bg-[#FF3FA4]/15 text-[#FF3FA4] flex items-center justify-center"
                        >
                            <ImagePlus size={22} />
                        </motion.span>
                        <p className="text-sm font-bold">Soltá la imagen acá</p>
                        <p className="text-xs text-muted">Se agrega al reporte como captura</p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default DropOverlay;
