import React, { useEffect, useRef, useState } from 'react';
import { Humo } from './Shared';

const HUMO_DOCK = ['var(--brand-secondary)', 'var(--brand-primary)',
    'var(--brand-secondary-light)', 'var(--brand-navy)'];

/**
 * El dock de secciones: la barra fija de abajo, numerada, con el indicador que se desliza hasta
 * la sección activa.
 *
 * Vive aparte porque lo usan dos pantallas: el dashboard comercial y el espacio del setter. Tienen
 * que ser EL MISMO panel y no una copia —el pedido fue justamente que el setter no viera un dock
 * al trabajar y otro al entrar a sus datos—, así que las dos lo montan de acá.
 *
 * Tiene que quedar dentro de un `.dc-shell`: sus estilos (`.dock`, `.dock-item`, `.dock-ind`)
 * cuelgan de ese shell. Quien no es el dashboard lo envuelve en un `.dc-shell--embebido`.
 *
 * `antes` es lo que va a la izquierda de la navegación, separado por una línea: en el dashboard,
 * el switch Closers/Setters de la dirección.
 */
const DockSecciones = ({ secciones, activa, onElegir, ariaLabel, antes = null }) => {
    // El indicador se mide del DOM porque su ancho es el del botón activo, y eso depende del texto
    // de cada sección y de si el label está visible (bajo 1120px se esconde el de los inactivos).
    // Se remide al cambiar de sección, al cambiar la lista y al redimensionar.
    const navRef = useRef(null);
    const [indicador, setIndicador] = useState({ '--w': '0px', '--x': '0px' });
    const ids = secciones.map(s => s.id).join('|');
    useEffect(() => {
        const medir = () => {
            const nav = navRef.current;
            const item = nav?.querySelector('[aria-current="page"]');
            if (!nav || !item) return;
            setIndicador({ '--w': `${item.offsetWidth}px`, '--x': `${item.offsetLeft}px` });
        };
        const id = requestAnimationFrame(medir);
        window.addEventListener('resize', medir);
        return () => { cancelAnimationFrame(id); window.removeEventListener('resize', medir); };
    }, [activa, ids]);

    return (
        <nav className="dock caja" aria-label={ariaLabel}>
            <Humo colores={HUMO_DOCK} />
            {antes}
            {antes && <span className="dock-sep" />}
            <div className="dock-nav" ref={navRef}>
                {/* Indicador que se desliza hasta el item activo, en vez de que cada uno pinte su
                    propio fondo: el movimiento dice de dónde a dónde se fue. */}
                <span className="dock-ind" style={indicador} aria-hidden="true" />
                {secciones.map((s, i) => (
                    <button key={s.id} type="button" className="dock-item"
                        aria-current={activa === s.id ? 'page' : undefined}
                        aria-label={s.label} onClick={() => onElegir(s.id)}>
                        <span className="dock-num">{i + 1}</span>
                        <s.Icono size={20} />
                        <span className="dock-label">{s.label}</span>
                        {s.pronto && <span className="dock-pronto">Pronto</span>}
                    </button>
                ))}
            </div>
        </nav>
    );
};

export { HUMO_DOCK };
export default DockSecciones;
