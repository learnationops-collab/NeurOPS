import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

/**
 * Ayuda contextual en lenguaje llano.
 *
 * El globo se renderiza con portal a `document.body` y posición fija: dentro de
 * las tarjetas del panel hay contenedores con `backdrop-blur`, que crean su propio
 * contexto de apilamiento y dejarían el globo por debajo del contenido siguiente
 * por más z-index que se le ponga (mismo problema que ya tuvieron los filtros del
 * Tablero de Agendas el 19/08/2026).
 */
const InfoTooltip = ({ text, label, size = 12, className = '' }) => {
    const [abierto, setAbierto] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const anclaRef = useRef(null);

    const recalcular = () => {
        if (!anclaRef.current) return;
        const r = anclaRef.current.getBoundingClientRect();
        // 280px es el ancho del globo; se corre para que no se salga por la derecha
        const left = Math.min(Math.max(8, r.left + r.width / 2 - 140), window.innerWidth - 288);
        setPos({ top: r.bottom + 8, left });
    };

    useEffect(() => {
        if (!abierto) return;
        recalcular();
        window.addEventListener('scroll', recalcular, true);
        window.addEventListener('resize', recalcular);
        return () => {
            window.removeEventListener('scroll', recalcular, true);
            window.removeEventListener('resize', recalcular);
        };
    }, [abierto]);

    return (
        <>
            <button
                ref={anclaRef}
                type="button"
                aria-label={label ? `Qué significa ${label}` : 'Más información'}
                onMouseEnter={() => setAbierto(true)}
                onMouseLeave={() => setAbierto(false)}
                onFocus={() => setAbierto(true)}
                onBlur={() => setAbierto(false)}
                onClick={(e) => { e.preventDefault(); setAbierto(v => !v); }}
                className={`inline-flex items-center justify-center text-slate-500 hover:text-indigo-400 transition-colors cursor-help align-middle ${className}`}
            >
                <HelpCircle size={size} />
            </button>
            {abierto && createPortal(
                <div
                    role="tooltip"
                    style={{ top: pos.top, left: pos.left, width: 280 }}
                    className="fixed z-[300] bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 shadow-2xl pointer-events-none"
                >
                    {label && (
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">{label}</p>
                    )}
                    <p className="text-[11px] leading-relaxed text-slate-300 font-medium normal-case tracking-normal">{text}</p>
                </div>,
                document.body
            )}
        </>
    );
};

export default InfoTooltip;
