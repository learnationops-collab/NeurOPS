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
    custom: 'el rango elegido',
    hoy: 'hoy',
    '7d': 'últimos 7 días',
    '30d': 'últimos 30 días',
    mes: 'este mes',
    mes_pasado: 'el mes pasado',
    '90': 'últimos 90 días'
};

export const COMPARE_LABELS = {
    prev: 'el período anterior',
    month: 'el mismo rango del mes anterior',
    year: 'el mismo rango del año anterior',
    none: ''
};

// 'YYYY-MM-DD' → 'DD/MM'. Se corta a mano en vez de usar Date para no correr un día por zona
// horaria (el string ya viene en la fecha calendario del backend).
export const shortDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

// Etiqueta del período en curso. El rango libre no tiene nombre fijo: se describe con sus fechas.
export const periodLabel = (period, dates) => {
    if (period === 'custom') {
        return dates?.start && dates?.end
            ? `${shortDate(dates.start)} al ${shortDate(dates.end)}`
            : 'rango personalizado';
    }
    return PERIOD_LABELS[period] || '';
};

// Etiqueta del rango de comparación, con sus fechas reales cuando el backend las devuelve.
export const compareLabel = (compare, dates) => {
    if (compare === 'none') return '';
    const base = COMPARE_LABELS[compare] || '';
    if (dates?.compare_start && dates?.compare_end) {
        return `${base} (${shortDate(dates.compare_start)} al ${shortDate(dates.compare_end)})`;
    }
    return base;
};
