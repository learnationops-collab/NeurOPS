import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * WheelSelector - Componente de selector vertical tipo "rueda" con scroll infinito
 * Los items anterior/siguiente se muestran FUERA del contenedor del dock
 * 
 * @param {Array} items - Array de objetos { id, icon: LucideIcon, label }
 * @param {number} activeIndex - Índice del item actualmente seleccionado
 * @param {Function} onChange - Callback cuando cambia la selección
 * @param {string} position - 'left' o 'right' para orientación
 * @param {string} variant - 'pill' o 'icon' para el estilo de renderizado
 */
const WheelSelector = ({ items, activeIndex, onChange, position = 'left', variant = 'icon' }) => {
    // Calcular índices para mostrar: anterior, actual, siguiente (con loop)
    const getPrevIndex = () => (activeIndex - 1 + items.length) % items.length;
    const getNextIndex = () => (activeIndex + 1) % items.length;

    const prevItem = items[getPrevIndex()];
    const currentItem = items[activeIndex];
    const nextItem = items[getNextIndex()];

    const handleWheel = (e) => {
        // Solo prevenir si hay scroll real para evitar bloquear el scroll de la página
        if (Math.abs(e.deltaY) > 5) {
            e.preventDefault();
            if (e.deltaY > 0) onChange(getNextIndex());
            else onChange(getPrevIndex());
        }
    };

    const handlePrev = () => onChange(getPrevIndex());
    const handleNext = () => onChange(getNextIndex());

    const isPill = variant === 'pill';

    return (
        <div
            className="relative flex flex-col items-center justify-center select-none"
            onWheel={handleWheel}
        >
            {/* Item Anterior (Flotando arriba) */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={`prev-${prevItem.id}`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 0.2, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                    onClick={handlePrev}
                    className="absolute -top-7 cursor-pointer hover:opacity-50 transition-opacity"
                >
                    <prevItem.icon size={14} className="text-muted" />
                </motion.div>
            </AnimatePresence>

            {/* Item Actual (DENTRO del dock) */}
            <motion.div
                key={`current-${currentItem.id}`}
                layoutId={`wheel-${position}`}
                className={`
                    flex items-center justify-center gap-3 transition-all duration-300
                    ${isPill
                        ? 'bg-primary text-white rounded-full min-w-[150px] h-[38px] px-5 shadow-lg shadow-primary/20'
                        : 'w-10 h-10 rounded-xl hover:bg-surface/50 text-muted hover:text-primary'}
                `}
            >
                <currentItem.icon size={isPill ? 18 : 20} className={isPill ? 'text-white' : ''} />
                {isPill && (
                    <span className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap">
                        {currentItem.label}
                    </span>
                )}
            </motion.div>

            {/* Item Siguiente (Flotando abajo) */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={`next-${nextItem.id}`}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 0.2, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.2 }}
                    onClick={handleNext}
                    className="absolute -bottom-7 cursor-pointer hover:opacity-50 transition-opacity"
                >
                    <nextItem.icon size={14} className="text-muted" />
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default WheelSelector;
