import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Un interruptor de encendido (`role="switch"`): prender o apagar la landing de la grabación. La
 * perilla corre con un resorte; con movimiento reducido salta.
 */
const Interruptor = ({ encendido, onCambiar, etiqueta, disabled, ocupado, title }) => {
    const quieto = useReducedMotion();
    return (
        <button type="button" role="switch" aria-checked={!!encendido} aria-label={etiqueta}
            className={`wt-interruptor${encendido ? ' wt-interruptor--on' : ''}${ocupado ? ' wt-interruptor--ocupado' : ''}`}
            disabled={disabled || ocupado} title={title} onClick={() => onCambiar(!encendido)}>
            <motion.i layout transition={quieto ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34 }} />
        </button>
    );
};

export default Interruptor;
