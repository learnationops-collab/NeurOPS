/**
 * Las cuentas de la tabla de anuncios que hace la pantalla: los períodos, los totales de las filas que
 * se ven, el orden y la serie por día. Las de cada fila las hace el backend
 * (`app/services/anuncios_service.py`); acá se repiten las mismas fórmulas para los totales, porque
 * cambian con lo que se filtra (archivados, búsqueda) y con lo que se elige para el gráfico.
 */

const pad = (n) => String(n).padStart(2, '0');
/** Día de calendario LOCAL (`toISOString` es UTC: en UTC−3 después de las 21 ya es mañana). */
export const diaLocal = (f) => `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
const masDias = (f, n) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + n);

/** Los períodos del selector, como en el Administrador de anuncios de Meta. */
export const PERIODOS = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'ayer', label: 'Ayer' },
    { key: 'ultimos_7', label: 'Últimos 7 días' },
    { key: 'ultimos_30', label: 'Últimos 30 días' },
    { key: 'este_mes', label: 'Este mes' },
    { key: 'mes_pasado', label: 'Mes pasado' },
    { key: 'personalizado', label: 'Personalizado', quedaAbierto: true },
];
export const PERIODO_POR_DEFECTO = 'ultimos_30';

/** { desde, hasta } de un período, en días locales. `null` para «Personalizado». */
export const rangoDePeriodo = (key, hoy = new Date()) => {
    const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    switch (key) {
        case 'hoy': return { desde: diaLocal(h), hasta: diaLocal(h) };
        case 'ayer': return { desde: diaLocal(masDias(h, -1)), hasta: diaLocal(masDias(h, -1)) };
        case 'ultimos_7': return { desde: diaLocal(masDias(h, -6)), hasta: diaLocal(h) };
        case 'ultimos_30': return { desde: diaLocal(masDias(h, -29)), hasta: diaLocal(h) };
        case 'este_mes': return { desde: diaLocal(new Date(h.getFullYear(), h.getMonth(), 1)), hasta: diaLocal(h) };
        case 'mes_pasado': return {
            desde: diaLocal(new Date(h.getFullYear(), h.getMonth() - 1, 1)),
            hasta: diaLocal(new Date(h.getFullYear(), h.getMonth(), 0)),
        };
        default: return null;
    }
};

export const SUMABLES = ['entrantes', 'calificados', 'descalificados', 'agendas', 'ventas', 'gasto', 'cobrado'];

const division = (num, den, decimales = 2) => (den ? Number((num / den).toFixed(decimales)) : null);

/** Los porcentajes y los costos de una base con las sumas. Sin gasto, los costos son null («—»):
 *  un 0 diría que el lead salió gratis. */
export const completar = (base) => {
    const { entrantes, calificados, agendas, ventas, cobrado } = base;
    const gasto = Number((base.gasto || 0).toFixed(2));
    const conGasto = gasto > 0;
    return {
        ...base,
        gasto,
        no_calificados: entrantes - calificados,
        pct_calificados: division(calificados * 100, entrantes, 1),
        pct_no_calificados: division((entrantes - calificados) * 100, entrantes, 1),
        cpl: conGasto ? division(gasto, entrantes) : null,
        cpl_calificado: conGasto ? division(gasto, calificados) : null,
        costo_agenda: conGasto ? division(gasto, agendas) : null,
        costo_venta: conGasto ? division(gasto, ventas) : null,
        roas: conGasto ? division(cobrado, gasto) : null,
    };
};

export const totalesDe = (filas) => completar(Object.fromEntries(
    SUMABLES.map((k) => [k, filas.reduce((s, f) => s + (Number(f[k]) || 0), 0)]),
));

/**
 * Las columnas de la tabla, en el orden de Meta: volumen, calidad, costo, resultados. `menor`: un costo,
 * donde menos es mejor (se usa para el orden por defecto al tocar el encabezado).
 */
export const COLUMNAS = [
    { key: 'entrantes', label: 'Leads entrantes', formato: 'num',
        ayuda: 'Personas que llegaron por esta palabra clave en el período, una vez cada una (el día de su primer mensaje con ella).' },
    { key: 'calificados', label: 'Calificados', formato: 'num', pct: 'pct_calificados',
        ayuda: 'Los entrantes que ManyChat marcó como calificados (la última calificación que mandó), y su porcentaje sobre los entrantes.' },
    { key: 'no_calificados', label: 'No calificados', formato: 'num', pct: 'pct_no_calificados',
        ayuda: 'El resto de los entrantes: los que ManyChat marcó que no califican y los que todavía no tienen respuesta.' },
    { key: 'gasto', label: 'Importe gastado', formato: 'money',
        ayuda: 'Lo que gastaron en Meta Ads los anuncios asociados a esta palabra clave, día por día.' },
    { key: 'cpl', label: 'Costo por lead', formato: 'money', menor: true,
        ayuda: 'Importe gastado ÷ leads entrantes.' },
    { key: 'cpl_calificado', label: 'Costo por calificado', formato: 'money', menor: true,
        ayuda: 'Importe gastado ÷ leads calificados.' },
    { key: 'agendas', label: 'Agendas', formato: 'num',
        ayuda: 'Agendas creadas en el período de personas cuya conversación de ManyChat vino por esta palabra clave (una por persona).' },
    { key: 'costo_agenda', label: 'Costo por agenda', formato: 'money', menor: true,
        ayuda: 'Importe gastado ÷ agendas.' },
    { key: 'ventas', label: 'Ventas', formato: 'num',
        ayuda: 'Pagos completos y split pay completados en el período, de personas que llegaron por esta palabra clave.' },
    { key: 'costo_venta', label: 'Costo por venta', formato: 'money', menor: true,
        ayuda: 'Importe gastado ÷ ventas.' },
    { key: 'cobrado', label: 'Cobrado', formato: 'money',
        ayuda: 'Todo lo cobrado en el período a las personas de esta palabra clave: ventas nuevas, cuotas y señas.' },
    { key: 'roas', label: 'ROAS', formato: 'veces',
        ayuda: 'Cobrado ÷ importe gastado.' },
];

const ENTERO = new Intl.NumberFormat('en-US');

/** Un monto: con centavos si es chico (un costo por lead de $1,15 no es «$1»), sin centavos si no. */
export const dinero = (v, moneda = 'USD') => {
    if (v === null || v === undefined) return '—';
    const simbolo = moneda === 'USD' || !moneda ? '$' : `${moneda} `;
    const abs = Math.abs(v);
    const texto = abs < 100
        ? abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ENTERO.format(Math.round(abs));
    return `${v < 0 ? '-' : ''}${simbolo}${texto}`;
};

export const formatear = (v, formato, moneda) => {
    if (v === null || v === undefined) return '—';
    if (formato === 'money') return dinero(v, moneda);
    if (formato === 'pct') return `${v}%`;
    if (formato === 'veces') return `${Number(v).toFixed(2)}x`;
    return ENTERO.format(v);
};

/** Ordena sin mover los «—» de abajo: un costo sin dato no es ni el mejor ni el peor. */
export const ordenar = (filas, clave, dir) => {
    const signo = dir === 'asc' ? 1 : -1;
    return [...filas].sort((a, b) => {
        const va = clave === 'nombre' ? (a.nombre || '').toLowerCase() : a[clave];
        const vb = clave === 'nombre' ? (b.nombre || '').toLowerCase() : b[clave];
        const nulaA = va === null || va === undefined;
        const nulaB = vb === null || vb === undefined;
        if (nulaA || nulaB) return nulaA === nulaB ? 0 : nulaA ? 1 : -1;
        if (va < vb) return -signo;
        if (va > vb) return signo;
        return (b.entrantes || 0) - (a.entrantes || 0);
    });
};

/**
 * La serie por día de las filas dadas, con todos los días del período (los vacíos en cero: un día sin
 * leads también es un dato). Cada fila trae `dias: { 'AAAA-MM-DD': [entrantes, calificados, gasto, agendas] }`.
 */
export const serieDe = (filas, desde, hasta) => {
    if (!desde || !hasta) return [];
    const [a, m, d] = desde.split('-').map(Number);
    const [a2, m2, d2] = hasta.split('-').map(Number);
    const fin = new Date(a2, m2 - 1, d2);
    const dias = [];
    for (let f = new Date(a, m - 1, d); f <= fin && dias.length < 400; f = masDias(f, 1)) {
        dias.push({ dia: diaLocal(f), entrantes: 0, calificados: 0, gasto: 0, agendas: 0 });
    }
    const indice = Object.fromEntries(dias.map((x, i) => [x.dia, i]));
    filas.forEach((fila) => {
        Object.entries(fila.dias || {}).forEach(([dia, [e, c, g, ag]]) => {
            const x = dias[indice[dia]];
            if (!x) return;
            x.entrantes += e || 0;
            x.calificados += c || 0;
            x.gasto += g || 0;
            x.agendas += ag || 0;
        });
    });
    return dias.map((x) => ({ ...x, gasto: Number(x.gasto.toFixed(2)) }));
};

/** El texto de los anuncios de Meta de una fila: «3 anuncios en Meta · 1 activo». */
export const textoMeta = (meta) => {
    if (!meta || !meta.anuncios) return null;
    const anuncios = `${meta.anuncios} ${meta.anuncios === 1 ? 'anuncio' : 'anuncios'} en Meta`;
    if (!meta.activos) return `${anuncios} · ninguno activo`;
    return `${anuncios} · ${meta.activos} ${meta.activos === 1 ? 'activo' : 'activos'}`;
};
