// Qué talleres analiza el Resumen (16/10/2026): todos, los últimos N, los de un período o los que
// se eligen a mano. Y contra qué se comparan (pastilla «VS», como en el dashboard comercial): los N
// talleres de antes, el período anterior de igual largo, el mes anterior, el mismo período del mes
// pasado, otros talleres elegidos a mano o unas fechas cualquiera.
//
// filtro      = { modo: 'todos' } | { modo: 'ultimos', n } | { modo: 'periodo', desde, hasta }
//             | { modo: 'elegidos', ids: [] }                       (fechas 'YYYY-MM-DD', inclusive)
// comparacion = { modo: 'none' | 'anteriores' | 'prev' | 'mes' | 'mismo_mes' }
//             | { modo: 'elegidos', ids: [] } | { modo: 'custom', desde, hasta }
//
// Las dos cosas viven en la URL con claves propias (ver `filtroDeParams`), así un link lleva a la
// misma vista y no chocan con `?tab=` de la página.

export const FILTRO_TODOS = { modo: 'todos' };

export const COMPARACIONES = [
    { key: 'anteriores', label: 'Talleres anteriores' },
    { key: 'prev', label: 'Período anterior' },
    { key: 'mes', label: 'Mes anterior' },
    { key: 'mismo_mes', label: 'Mismo período mes pasado' },
    { key: 'elegidos', label: 'Elegir talleres' },
    { key: 'custom', label: 'Personalizado' },
    { key: 'none', label: 'Sin comparar' },
];
const MODOS_VS = COMPARACIONES.map((c) => c.key);

// Del más nuevo al más viejo, sin depender del orden en que llegan.
const porFecha = (talleres) => [...(talleres || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const esDia = (v) => ISO.test(v || '');

const partes = (iso) => iso.split('-').map(Number);
const aIso = (f) => f.toISOString().slice(0, 10);
const dos = (n) => String(n).padStart(2, '0');

const sumarDias = (iso, dias) => {
    const [y, m, d] = partes(iso);
    return aIso(new Date(Date.UTC(y, m - 1, d + dias)));
};

const diasEntre = (desde, hasta) => {
    const [y1, m1, d1] = partes(desde);
    const [y2, m2, d2] = partes(hasta);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

const diasDelMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1-12
const mesPrevio = (y, m) => (m === 1 ? [y - 1, 12] : [y, m - 1]);

// El mismo día un mes antes; el 31/03 cae en el último día de febrero.
const mesAntes = (iso) => {
    const [y, m, d] = partes(iso);
    const [ya, ma] = mesPrevio(y, m);
    return `${ya}-${dos(ma)}-${dos(Math.min(d, diasDelMes(ya, ma)))}`;
};

const entre = (talleres, desde, hasta) => talleres.filter((t) => (!desde || t.date >= desde) && (!hasta || t.date <= hasta));

export function filtrarTalleres(talleres, filtro) {
    const ordenados = porFecha(talleres);
    switch (filtro?.modo) {
        case 'ultimos':
            return ordenados.slice(0, Math.max(1, filtro.n || 1));
        case 'periodo':
            return entre(ordenados, filtro.desde, filtro.hasta);
        case 'elegidos': {
            const ids = new Set(filtro.ids || []);
            return ordenados.filter((t) => ids.has(t.id));
        }
        default:
            return ordenados;
    }
}

/**
 * Los días que cubre la selección: el período elegido, o del primer al último taller que entra.
 * null si no hay nada.
 */
export function rangoDeSeleccion(talleres, filtro) {
    if (filtro?.modo === 'periodo' && esDia(filtro.desde) && esDia(filtro.hasta) && filtro.desde <= filtro.hasta) {
        return { desde: filtro.desde, hasta: filtro.hasta };
    }
    const elegidos = filtrarTalleres(talleres, filtro);
    if (!elegidos.length) return null;
    return { desde: elegidos[elegidos.length - 1].date, hasta: elegidos[0].date };
}

/** Lo que se compara si nadie eligió otra cosa: lo de antes del rediseño (todos y elegidos, nada). */
export function comparacionPorDefecto(filtro) {
    if (filtro?.modo === 'ultimos') return { modo: 'anteriores' };
    if (filtro?.modo === 'periodo') return { modo: 'prev' };
    return { modo: 'none' };
}

/** Las fechas de una comparación por calendario, a partir de los días de la selección. */
export function rangoComparado(comparacion, rango) {
    if (comparacion?.modo === 'custom') {
        const { desde, hasta } = comparacion;
        if (!esDia(desde) || !esDia(hasta)) return null;
        return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde };
    }
    if (!rango) return null;
    switch (comparacion?.modo) {
        case 'prev': {
            const largo = diasEntre(rango.desde, rango.hasta);
            const hasta = sumarDias(rango.desde, -1);
            return { desde: sumarDias(hasta, -largo), hasta };
        }
        case 'mes': {
            // El mes calendario entero anterior al del último día de la selección.
            const [y, m] = partes(rango.hasta);
            const [ya, ma] = mesPrevio(y, m);
            return { desde: `${ya}-${dos(ma)}-01`, hasta: `${ya}-${dos(ma)}-${dos(diasDelMes(ya, ma))}` };
        }
        case 'mismo_mes':
            return { desde: mesAntes(rango.desde), hasta: mesAntes(rango.hasta) };
        default:
            return null;
    }
}

/**
 * Los talleres contra los que se compara la selección y los días que cubren, o null si no hay con
 * qué (sin comparar, o la comparación no tiene ningún taller).
 */
export function talleresComparados(talleres, filtro, comparacion = comparacionPorDefecto(filtro)) {
    const ordenados = porFecha(talleres);
    const analizados = filtrarTalleres(ordenados, filtro);
    let lista = null;
    let rango = null;
    switch (comparacion?.modo) {
        case 'anteriores': {
            // Los N de antes del más viejo de la selección (N = cuántos se analizan). Con «todos» no
            // queda nada antes.
            if (!analizados.length) break;
            const dentro = new Set(analizados.map((t) => t.id));
            const desde = ordenados.indexOf(analizados[analizados.length - 1]) + 1;
            lista = ordenados.slice(desde).filter((t) => !dentro.has(t.id)).slice(0, analizados.length);
            break;
        }
        case 'elegidos': {
            const ids = new Set(comparacion.ids || []);
            lista = ordenados.filter((t) => ids.has(t.id));
            break;
        }
        case 'prev':
        case 'mes':
        case 'mismo_mes':
        case 'custom':
            rango = rangoComparado(comparacion, rangoDeSeleccion(ordenados, filtro));
            if (rango) lista = entre(ordenados, rango.desde, rango.hasta);
            break;
        default:
            break;
    }
    if (!lista || !lista.length) return null;
    return { talleres: lista, rango: rango || { desde: lista[lista.length - 1].date, hasta: lista[0].date } };
}

// Los talleres contra los que se compara la selección por defecto, o null si no hay con qué.
export function talleresAnteriores(talleres, filtro) {
    return talleresComparados(talleres, filtro)?.talleres || null;
}

// Los totales que muestran las tarjetas del Resumen. ROAS = cobrado / inversión.
export function totalesResumen(talleres) {
    const t = { inversion: 0, clics: 0, leads: 0, whatsapp_leads: 0, agendas: 0, sales: 0, cash: 0, cash_ventas: 0, ventas_cobradas: 0 };
    (talleres || []).forEach((e) => {
        t.inversion += e.inversion || 0;
        t.clics += e.clics || 0;
        t.leads += e.leads || 0;
        t.whatsapp_leads += e.whatsapp_leads || 0;
        t.agendas += e.agendas_exitosas || 0;
        t.sales += e.sales || 0;
        t.cash += e.cash_collected || 0;
        t.cash_ventas += e.cash_ventas || 0;
        t.ventas_cobradas += e.ventas_cobradas || 0;
    });
    return { ...t, roas: t.inversion > 0 ? t.cash / t.inversion : 0 };
}

// Variación (en %) de la selección contra los anteriores. Las sumas se comparan POR TALLER (un período
// puede tener más talleres que el anterior); el ROAS ya es una razón. null si no hay base.
export function variaciones(actual, cantidadActual, anterior, cantidadAnterior) {
    if (!anterior || !cantidadActual || !cantidadAnterior) return null;
    const cambio = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    const porTaller = (clave) => cambio(actual[clave] / cantidadActual, anterior[clave] / cantidadAnterior);
    return {
        inversion: porTaller('inversion'),
        cash: porTaller('cash'),
        roas: cambio(actual.roas, anterior.roas),
        leads: porTaller('leads'),
        agendas: porTaller('agendas'),
        sales: porTaller('sales'),
    };
}

// ---------------------------------------------------------------------------------------------
// La URL. Claves propias del Resumen: rf/rn/rd/rh/ri (qué se analiza) y vs/vd/vh/vi (contra qué).
// Sin claves es lo de siempre: todos los talleres y la comparación por defecto.

const idsDe = (texto) => (texto || '').split(',').map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);

export function filtroDeParams(params) {
    const modo = params.get('rf');
    if (modo === 'ultimos') {
        const n = parseInt(params.get('rn'), 10);
        return { modo, n: Number.isInteger(n) && n > 0 ? n : 5 };
    }
    if (modo === 'periodo') return { modo, desde: params.get('rd') || '', hasta: params.get('rh') || '' };
    if (modo === 'elegidos') return { modo, ids: idsDe(params.get('ri')) };
    return FILTRO_TODOS;
}

export function comparacionDeParams(params, filtro) {
    const modo = params.get('vs');
    if (!MODOS_VS.includes(modo)) return comparacionPorDefecto(filtro);
    if (modo === 'custom') return { modo, desde: params.get('vd') || '', hasta: params.get('vh') || '' };
    if (modo === 'elegidos') return { modo, ids: idsDe(params.get('vi')) };
    return { modo };
}

/** Las claves a escribir (null = borrar) para un filtro. */
export function paramsDeFiltro(filtro) {
    const vacio = { rf: null, rn: null, rd: null, rh: null, ri: null };
    switch (filtro?.modo) {
        case 'ultimos': return { ...vacio, rf: 'ultimos', rn: String(filtro.n) };
        case 'periodo': return { ...vacio, rf: 'periodo', rd: filtro.desde || null, rh: filtro.hasta || null };
        case 'elegidos': return { ...vacio, rf: 'elegidos', ri: (filtro.ids || []).join(',') || null };
        default: return vacio;
    }
}

/** Las claves de una comparación. La que coincide con la de por defecto no se escribe. */
export function paramsDeComparacion(comparacion, filtro) {
    const vacio = { vs: null, vd: null, vh: null, vi: null };
    if (!comparacion || comparacion.modo === comparacionPorDefecto(filtro).modo) return vacio;
    if (comparacion.modo === 'custom') return { ...vacio, vs: 'custom', vd: comparacion.desde || null, vh: comparacion.hasta || null };
    if (comparacion.modo === 'elegidos') return { ...vacio, vs: 'elegidos', vi: (comparacion.ids || []).join(',') || null };
    return { ...vacio, vs: comparacion.modo };
}
