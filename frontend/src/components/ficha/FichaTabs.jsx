import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import usarMovimiento from './piezas/movimiento';

/**
 * Tablist de la ficha. Navegable con flechas, Inicio y Fin, como manda un tablist
 * de verdad: con seis pestañas, moverse con Tab entre todas para llegar a la última
 * es peor que no tener atajo.
 */
const FichaTabs = ({ pestanas = [], activa, onCambiar }) => {
    const refs = useRef({});
    const mov = usarMovimiento();

    const mover = (e) => {
        const i = pestanas.findIndex(p => p.id === activa);
        const teclas = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: pestanas.length - 1 };
        if (!(e.key in teclas)) return;
        e.preventDefault();
        const destino = pestanas[(teclas[e.key] + pestanas.length) % pestanas.length];
        if (!destino) return;
        onCambiar(destino.id);
        refs.current[destino.id]?.focus();
    };

    return (
        <div role="tablist" className="fi-tabs" aria-label="Secciones de la ficha" onKeyDown={mover}>
            {pestanas.map(p => {
                const on = p.id === activa;
                return (
                    <button key={p.id} type="button" role="tab" className="fi-tab"
                        id={`fi-tab-${p.id}`}
                        ref={(el) => { refs.current[p.id] = el; }}
                        aria-selected={on}
                        aria-controls={`fi-panel-${p.id}`}
                        tabIndex={on ? 0 : -1}
                        onClick={() => onCambiar(p.id)}>
                        {p.label}
                        {/* `layoutId` hace que el subrayado se corra de una pestaña a la
                            otra en vez de reaparecer del otro lado. */}
                        {on && (
                            <motion.span layoutId="fi-tab-sub" className="fi-tab-sub"
                                aria-hidden="true" {...mov.subrayado} />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default FichaTabs;
