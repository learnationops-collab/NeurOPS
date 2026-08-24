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
    custom: 'el rango elegido a mano',
    none: ''
};

// 'YYYY-MM-DD' → 'DD/MM' (o 'DD/MM/YYYY' con `withYear`). Se corta a mano en vez de usar Date
// para no correr un día por zona horaria (el string ya viene en la fecha calendario del backend).
export const shortDate = (iso, withYear = false) =>
    (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}${withYear ? `/${iso.slice(0, 4)}` : ''}` : '');

// Etiqueta del período en curso. El rango libre no tiene nombre fijo: se describe con sus fechas.
export const periodLabel = (period, dates) => {
    if (period === 'custom') {
        return dates?.start && dates?.end
            ? `${shortDate(dates.start)} al ${shortDate(dates.end)}`
            : 'rango personalizado';
    }
    return PERIOD_LABELS[period] || '';
};

// Etiqueta del rango de comparación, con sus fechas reales cuando el backend las devuelve. El
// año se agrega solo cuando el rango comparado cae en otro año: sin eso, comparar contra el año
// anterior muestra dos rangos con las mismas fechas y parece un error.
export const compareLabel = (compare, dates) => {
    if (compare === 'none') return '';
    const base = COMPARE_LABELS[compare] || '';
    if (dates?.compare_start && dates?.compare_end) {
        const otroAnio = dates.compare_start.slice(0, 4) !== (dates.start || '').slice(0, 4);
        return `${base} (${shortDate(dates.compare_start, otroAnio)} al ${shortDate(dates.compare_end, otroAnio)})`;
    }
    return base;
};
