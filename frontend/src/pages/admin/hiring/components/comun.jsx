import React from 'react';

// Lo que comparten la tabla y el modal de la postulación: los colores de cada
// veredicto y el medidor de puntitos del modal.

export const VEREDICTO = {
    seleccionada: { label: 'Seleccionada', fg: '#2FBF8F', bg: '#071A24', bd: '#10413D' },
    en_reserva: { label: 'En reserva', fg: '#8AA3FF', bg: 'rgba(91,124,255,.14)', bd: 'rgba(91,124,255,.5)' },
    testeo: { label: 'En prueba', fg: '#D9A441', bg: '#1A171C', bd: '#473924' },
    winner: { label: 'Winner', fg: '#2FBF8F', bg: '#071A24', bd: '#10413D' },
    top_tier: { label: 'Top tier', fg: '#FF6AD5', bg: 'rgba(255,63,164,.12)', bd: 'rgba(255,63,164,.45)' },
    descartado: { label: 'Descartada', fg: 'rgba(255,255,255,.82)', bg: 'rgba(255,255,255,.05)', bd: 'rgba(255,255,255,.38)' },
    baja: { label: 'Baja', fg: '#E85C4A', bg: '#1B0F1D', bd: '#4C2227' },
    incompleta: { label: 'Incompleta', fg: '#E85C4A', bg: '#1B0F1D', bd: '#4C2227' },
    sin_analizar: { label: 'Sin analizar', fg: '#4E8BD8', bg: '#0A152C', bd: '#1A3155' },
};

/** Medidor de 4 puntitos: el nivel de una respuesta de un vistazo. `redondos`
 * los achica a puntos, para las filas angostas del modal. */
export const Dots = ({ n, color = '#5B7CFF', redondos = false }) => (
    <span className="flex gap-[3px]">
        {[1, 2, 3, 4].map((j) => (
            <span
                key={j}
                className={redondos ? 'h-[5px] w-[5px] rounded-full' : 'h-[5px] w-[9px] rounded-sm'}
                style={{ background: j <= n ? color : 'rgba(255,255,255,.14)' }}
            />
        ))}
    </span>
);
