// Utilidades de los bloques de números.

// Texto de un campo → número o null (vacío).
export const aNumero = (t) => {
    const s = String(t ?? '').trim().replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

// Todos los valores de un bloque (para saber si está entero sin cargar).
export function valores(b) {
    if (b.t === 'comparar') return (b.filas || []).flatMap((f) => f.celdas || []);
    if (b.t === 'pasos') return (b.series || []).flatMap((s) => s.pasos || []);
    if (b.t === 'cifras') return b.items || [];
    return [];
}

// Un bloque de datos a mano que todavía no se cargó: se muestra el aviso en lugar de los «—».
export const sinCargar = (b) => { const vs = valores(b); return vs.length > 0 && vs.every((x) => x.mano && x.v == null); };
