import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useComportamientoModal } from '../../../../components/ui/Modal';

/**
 * El panel grande donde se abre el detalle de un taller (y el embudo general de la landing): el
 * `.modal` del dashboard comercial, más ancho, en un portal a `body`. El velo lleva `dc-shell` para
 * tener tokens y estilos fuera del tablero (como dice el `.scrim` de comercial.css). Escape, foco
 * atrapado y scroll trabado los pone `useComportamientoModal`, el mismo de `Modal`.
 *
 * `cabeza` va fija arriba (no se va con el scroll); `children` es el cuerpo.
 */
const Hoja = ({ titulo, cabeza, onCerrar, children }) => {
    const panel = useRef(null);
    const { cerrar, atraparTab, propsFondo } = useComportamientoModal({ onCerrar, panel });
    const quieto = useReducedMotion();

    return createPortal(
        <div className="dc-shell scrim wt-velo" {...propsFondo}>
            <motion.div ref={panel} className="modal wt-hoja" role="dialog" aria-modal="true" aria-label={titulo}
                tabIndex={-1} onKeyDown={atraparTab}
                initial={quieto ? false : { opacity: 0, y: 18, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={quieto ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
                <div className="wt-hoja-cabeza">
                    <div className="wt-hoja-cabeza-txt">{cabeza}</div>
                    <button type="button" className="ibtn" onClick={cerrar} aria-label="Cerrar"><X aria-hidden="true" /></button>
                </div>
                <div className="wt-hoja-cuerpo">{children}</div>
            </motion.div>
        </div>,
        document.body,
    );
};

export default Hoja;
