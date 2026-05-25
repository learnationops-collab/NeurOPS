import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers } from 'lucide-react';

const MazoCartas = ({ cards, currentIndex, children }) => {
    const totalCards = cards.length;
    const remaining = totalCards - currentIndex;

    return (
        <div className="relative w-full max-w-xl mx-auto h-[600px] flex items-center justify-center">
            {remaining === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/50 border border-slate-800 rounded-[2.5rem] shadow-2xl space-y-4"
                >
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full animate-bounce">
                        <Layers size={36} />
                    </div>
                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">¡Mazo Completado!</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Has procesado todos los prospectos de tu cola.</p>
                </motion.div>
            ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                    <AnimatePresence mode="popLayout">
                        {cards.slice(currentIndex, currentIndex + 3).map((card, idx) => {
                            const isFront = idx === 0;
                            // Offset visual para el efecto 3D
                            const offset = idx * 12;
                            const scale = 1 - idx * 0.04;
                            const zIndex = 30 - idx;

                            return (
                                <motion.div
                                    key={card.id}
                                    style={{
                                        zIndex,
                                        transformOrigin: "bottom center",
                                    }}
                                    initial={isFront ? { x: 300, opacity: 0, scale: 0.9, rotate: 5 } : { opacity: 0 }}
                                    animate={{
                                        x: 0,
                                        y: -offset,
                                        scale,
                                        opacity: isFront ? 1 : 0.8 / (idx + 0.2),
                                        rotate: 0,
                                    }}
                                    exit={{
                                        x: -300,
                                        opacity: 0,
                                        scale: 0.8,
                                        rotate: -10,
                                        transition: { duration: 0.4 }
                                    }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className={`absolute w-full h-full max-h-[580px] bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto overflow-x-hidden ${
                                        isFront ? 'pointer-events-auto' : 'pointer-events-none'
                                    }`}
                                >
                                    {isFront ? children : (
                                        <div className="flex flex-col justify-between h-full blur-[2px] select-none opacity-50">
                                            <div className="h-6 w-32 bg-slate-800 rounded-full" />
                                            <div className="space-y-4">
                                                <div className="h-8 w-full bg-slate-800 rounded-2xl" />
                                                <div className="h-24 w-full bg-slate-800 rounded-2xl" />
                                            </div>
                                            <div className="h-12 w-full bg-slate-800 rounded-2xl" />
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default MazoCartas;
