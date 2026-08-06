export const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');

export const pct = (n) => `${(n ?? 0)}%`;

// Delta entre el período actual y el de comparación. Devuelve null si no hay
// base de comparación (compare === 'none' o sin datos previos).
export const computeDelta = (current, previous) => {
    if (previous === null || previous === undefined) return null;
    if (!previous) return { pct: null, isNew: true };
    const diff = Math.round(((current - previous) / previous) * 100);
    return { pct: diff, isNew: false };
};

export const PERIOD_LABELS = {
    hoy: 'hoy',
    '7d': 'últimos 7 días',
    '30d': 'últimos 30 días',
    mes: 'este mes',
    mes_pasado: 'el mes pasado',
    '90': 'últimos 90 días'
};

export const COMPARE_LABELS = {
    prev: 'el período anterior',
    month: 'el mes anterior',
    none: ''
};
