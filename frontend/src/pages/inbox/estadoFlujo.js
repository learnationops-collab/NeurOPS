// Estado de un flujo para <Status> y cómo se nombra un paso: lo comparten la lista de flujos, el
// lienzo y las conversaciones.
export const ESTADOS = {
    activo: { label: 'Activo', color: 'var(--success)' },
    pausado: { label: 'Pausado', color: 'var(--idle)' },
    borrador: { label: 'Borrador', color: 'var(--text-muted)' },
};

export function estadoDe(flujo) {
    const e = ESTADOS[flujo.estado] || { label: flujo.estado, color: undefined };
    return { color: e.color, texto: e.label + (flujo.version ? ` · v${flujo.version}` : '') };
}

// «Paso 4 · Cualificación» (o solo «Paso 4» si el paso no tiene nombre).
export function rotuloPaso(paso) {
    if (!paso) return '';
    const numero = paso.numero ? `Paso ${paso.numero}` : 'Paso sin conectar';
    return paso.nombre ? `${numero} · ${paso.nombre}` : numero;
}

export function porciento(x) {
    return x == null ? '—' : `${Math.round(x * 100)}%`;
}
