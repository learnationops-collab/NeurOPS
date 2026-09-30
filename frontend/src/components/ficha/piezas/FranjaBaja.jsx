import React from 'react';
import { motion } from 'framer-motion';
import { UserX } from 'lucide-react';
import useMovimiento from './useMovimiento';

/**
 * La marca de un cliente dado de baja, debajo de los datos de la cabecera.
 *
 * Va en la cabecera y no en una pestaña porque tiene que verse desde cualquiera: quien abre la
 * ficha para agendarle algo, corregir un pago o leer el historial tiene que saber, antes de
 * hacer nada, que este cliente ya no está en el programa. `baja` es lo que manda el backend en
 * `identidad.baja` (`{fecha, fecha_legible, motivo, por}`), o null.
 *
 * El rótulo va en `<small>`: el CSS global anula el tracking de los `span` y los `div`.
 */
const FranjaBaja = ({ baja }) => {
    const mov = useMovimiento();
    if (!baja) return null;

    const cuando = baja.fecha_legible ? `el ${baja.fecha_legible}` : null;
    const detalle = [baja.motivo, baja.por && `por ${baja.por}`].filter(Boolean).join(' · ');

    return (
        <motion.div role="note" aria-label="Cliente dado de baja" {...mov.campo(0)}
            style={{
                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--s2)',
                padding: 'var(--s2) var(--s3)', borderRadius: 10,
                border: '1px solid var(--idle-border)', background: 'var(--idle-surface)',
                color: 'var(--idle)',
            }}>
            <UserX size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
            <small className="t-rotulo" style={{ color: 'var(--idle)' }}>
                Dado de baja{cuando ? ` ${cuando}` : ''}
            </small>
            {detalle && <span className="t-sm" style={{ fontWeight: 600 }}>{detalle}</span>}
        </motion.div>
    );
};

export default FranjaBaja;
