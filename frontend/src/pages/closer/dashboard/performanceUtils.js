import { tip } from './metricSources';

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
    ayer: 'ayer',
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

// Las 6 tasas de "Calidad de la llamada", con su fracción real detrás del porcentaje. Vive acá
// (y no duplicada en cada componente que necesita saber cuál es la más floja) porque tanto
// PerformanceQuality como PerformanceHighlights la usan para encontrar el eslabón más débil.
export const qualityItems = (rings, funnel, confirmaciones) => {
    const v = funnel?.values || [];
    const [, agendas = 0, confirmadas = 0, asistencias = 0, presentaciones = 0, ventas = 0] = v;
    return [
        { metric: 'q_confirmation_rate', label: 'Confirmation rate', value: rings.confirmation_rate,
            num: confirmaciones?.del_periodo ?? confirmadas, den: confirmaciones?.agendas_periodo ?? agendas, unit: 'agendas', group: 'llegar' },
        { metric: 'q_show_rate', label: 'Show rate', value: rings.show_rate,
            num: asistencias, den: agendas, unit: 'agendas', group: 'llegar' },
        { metric: 'q_show_sobre_confirmada', label: 'Show s/ confirmada', value: rings.show_sobre_confirmada,
            num: asistencias, den: confirmadas, unit: 'confirmadas', group: 'llegar' },
        { metric: 'q_pitch_rate', label: 'Pitch rate', value: rings.pitch_rate,
            num: presentaciones, den: asistencias, unit: 'asistencias', group: 'convertir' },
        { metric: 'q_close_llamada', label: 'Close s/ llamada', value: rings.close_llamada,
            num: ventas, den: asistencias, unit: 'asistencias', group: 'convertir' },
        { metric: 'q_close_presentacion', label: 'Close s/ presentación', value: rings.close_presentacion,
            num: ventas, den: presentaciones, unit: 'presentaciones', group: 'convertir' }
    ];
};

// El eslabón más débil se mide contra la salud relativa al umbral de cada tasa, no contra el
// porcentaje crudo: un 45% de close rate es excelente y un 45% de show rate es un problema, así
// que compararlos entre sí en bruto marcaría siempre al close como el peor.
export const computeWeakestQuality = (items) => {
    let weakest = null;
    items.forEach(it => {
        const b = tip(it.metric).benchmark;
        if (!b || it.value > 100 || !it.den) return;
        const ratio = it.value / b.good;
        if (!weakest || ratio < weakest.ratio) weakest = { ...it, ratio, benchmarkGood: b.good };
    });
    if (weakest && weakest.ratio >= 1) return null;
    return weakest;
};

// Cuánta plata se estima ganar si el eslabón más débil llegara a su umbral de referencia:
// proyecta el excedente de esa tasa hasta "ventas" pasando por la tasa de cierre que le sigue en
// la cadena, y lo valoriza al ticket promedio. Es una estimación, no una promesa — mezclar el
// paso débil con el resto del embudo (sano) es lo mismo que ya hace el resto del dashboard al
// leer conversión paso a paso.
export const estimateUpside = (weakest, funnel, rings, ticketPromedio) => {
    if (!weakest || !ticketPromedio) return null;
    const v = funnel?.values || [];
    const [, agendas = 0, confirmadas = 0, asistencias = 0, presentaciones = 0] = v;
    const gap = weakest.benchmarkGood - weakest.value;
    if (gap <= 0) return null;

    const closeLlamada = rings.close_llamada / 100;
    const closePresentacion = rings.close_presentacion / 100;
    let extraVentas = 0;
    switch (weakest.metric) {
        case 'q_confirmation_rate':
            extraVentas = (agendas * gap / 100) * (rings.show_sobre_confirmada / 100) * closeLlamada;
            break;
        case 'q_show_rate':
            extraVentas = (agendas * gap / 100) * closeLlamada;
            break;
        case 'q_show_sobre_confirmada':
            extraVentas = (confirmadas * gap / 100) * closeLlamada;
            break;
        case 'q_pitch_rate':
            extraVentas = (asistencias * gap / 100) * closePresentacion;
            break;
        case 'q_close_llamada':
            extraVentas = asistencias * gap / 100;
            break;
        case 'q_close_presentacion':
            extraVentas = presentaciones * gap / 100;
            break;
        default:
            return null;
    }
    return extraVentas > 0 ? Math.round(extraVentas * ticketPromedio) : null;
};
