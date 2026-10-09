import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * A quién del equipo se le hizo un pago por transferencia: Pedro, Jean Carlo u Otro, en el control
 * segmentado de la ficha (`.fi-seg`, el de `SiNo`). Pedido de Kerwin (09/10/2026).
 *
 * Las opciones llegan del vocabulario (`vocabulario.transferido_a`): esta pieza no conoce ningún
 * nombre. `sinMarcar` agrega «Sin marcar» (valor null) para devolver a ese estado un pago que ya
 * estaba marcado; en el alta de un pago no se ofrece, porque ahí la pregunta es obligatoria.
 *
 * Es un grupo de botones con `aria-pressed`, como `SiNo`: la marca del elegido se corre de una
 * opción a la otra (`layoutId`, con un id propio por si hay dos montadas) y con movimiento
 * reducido salta sin animar.
 */
const ElegirTransferencia = ({
    opciones = [], valor = null, onElegir, etiqueta, sinMarcar = false, disabled = false, chico = false,
}) => {
    const reducido = useReducedMotion();
    const marca = useId();
    const lista = sinMarcar ? [...opciones, { clave: null, label: 'Sin marcar' }] : opciones;
    return (
        <div className={`fi-seg${chico ? ' fi-seg--sm' : ''}`} role="group" aria-label={etiqueta}>
            {lista.map(o => {
                const activo = (valor ?? null) === o.clave;
                return (
                    <button key={o.clave ?? 'sin-marcar'} type="button" className="fi-seg-op"
                        aria-pressed={activo} disabled={disabled} onClick={() => onElegir?.(o.clave)}>
                        {activo && (
                            <motion.span className="fi-seg-marca" aria-hidden="true"
                                {...(reducido ? {} : {
                                    layoutId: `fi-seg-transferencia-${marca}`,
                                    transition: { type: 'spring', bounce: 0.18, duration: 0.36 },
                                })} />
                        )}
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
};

export default ElegirTransferencia;
