import React, { useRef } from 'react';

/**
 * Tablist de la ficha. Navegable con flechas, Inicio y Fin, como manda un tablist
 * de verdad: con seis pestañas, moverse con Tab entre todas para llegar a la última
 * es peor que no tener atajo.
 */
const FichaTabs = ({ pestanas = [], activa, onCambiar }) => {
    const refs = useRef({});

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
                        {on && <span className="fi-tab-sub" aria-hidden="true" />}
                    </button>
                );
            })}
        </div>
    );
};

export default FichaTabs;
