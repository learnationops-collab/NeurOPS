import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const OPCIONES = [{ valor: true, label: 'Sí' }, { valor: false, label: 'No' }];

/**
 * Sí o no, en el control segmentado de la ficha (`.fi-seg`, el de «Pendiente | Realizado» del
 * historial y el de la cantidad de cuotas).
 *
 * Es una pieza porque la misma pregunta —«¿Agendás un seguimiento a futuro?»— aparece en «Dar de
 * baja» (Acciones) y en «Canceló» y «Descartar lead» (Confirmación), y cada pantalla la dibujaba a
 * su manera: dos `.ln-chip` que dentro de `.dc-shell` perdían el borde y el aire, o dos pastillas
 * con el magenta inline. La misma pregunta tiene que verse igual en las tres.
 *
 * La marca del elegido se corre de una opción a la otra (`layoutId`, con un id propio por si hay
 * dos montadas) y con movimiento reducido salta sin animar.
 */
const SiNo = ({ valor, onElegir, etiqueta }) => {
    const reducido = useReducedMotion();
    const marca = useId();
    return (
        <div className="fi-seg" role="group" aria-label={etiqueta}>
            {OPCIONES.map(o => {
                const activo = valor === o.valor;
                return (
                    <button key={o.label} type="button" className="fi-seg-op" aria-pressed={activo}
                        onClick={() => onElegir(o.valor)}>
                        {activo && (
                            <motion.span className="fi-seg-marca" aria-hidden="true"
                                {...(reducido ? {} : {
                                    layoutId: `fi-seg-sino-${marca}`,
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

export default SiNo;
