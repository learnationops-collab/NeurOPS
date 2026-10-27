export const TIPOS = {
    cobranza: { label: 'Cobranza', color: 'var(--ln-brand-2)' },
    cobro: { label: 'Cobro sin venta', color: 'var(--ln-warning)' },
    datos: { label: 'Datos', color: 'var(--ln-info)' },
    fichas: { label: 'Fichas compartidas', color: 'var(--ln-info)' },
    producto: { label: 'Producto distinto', color: 'var(--ln-warning)' },
};

export const pesos = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`);

export const dia = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};
