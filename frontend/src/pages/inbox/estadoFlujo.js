// Estado de un flujo para <Status>: lo comparten la lista de flujos y el lienzo.
export const ESTADOS = {
    activo: { label: 'Activo', color: 'var(--success)' },
    pausado: { label: 'Pausado', color: 'var(--idle)' },
    borrador: { label: 'Borrador', color: 'var(--text-muted)' },
};

export function estadoDe(flujo) {
    const e = ESTADOS[flujo.estado] || { label: flujo.estado, color: undefined };
    return { color: e.color, texto: e.label + (flujo.version ? ` · v${flujo.version}` : '') };
}
