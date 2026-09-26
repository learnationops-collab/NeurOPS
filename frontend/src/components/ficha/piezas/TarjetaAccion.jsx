import React from 'react';

/**
 * Tarjeta de acción: ícono arriba, rótulo abajo, tono por `--c`.
 *
 * `linea` la achica a una sola fila para la barra de acciones de Confirmación,
 * donde tres tarjetas altas competirían con el CTA del pie.
 */
const TarjetaAccion = ({ tono = 'info', icono: Icono = null, label, onClick, linea = false, deshabilitado = false, titulo = null }) => (
    <button type="button"
        className={`fi-accion caja${linea ? ' fi-accion--linea' : ''}`}
        style={{ '--c': `var(--${tono})` }}
        disabled={deshabilitado}
        title={titulo || undefined}
        onClick={onClick}>
        {Icono && <span style={{ display: 'flex' }}><Icono size={linea ? 18 : 24} /></span>}
        <span>{label}</span>
    </button>
);

export default TarjetaAccion;
