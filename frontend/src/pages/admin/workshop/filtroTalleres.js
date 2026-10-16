// Qué talleres analiza el Resumen (16/10/2026): todos, los últimos N, los de un período o los que
// se eligen a mano. Y contra qué se comparan: los N anteriores, o el período de igual largo justo
// antes. Elegidos a mano no tienen un «anterior» natural, así que no se comparan.
//
// filtro = { modo: 'todos' } | { modo: 'ultimos', n } | { modo: 'periodo', desde, hasta }
//        | { modo: 'elegidos', ids: [] }   (fechas 'YYYY-MM-DD', inclusive)

export const FILTRO_TODOS = { modo: 'todos' };

// Del más nuevo al más viejo, sin depender del orden en que llegan.
const porFecha = (talleres) => [...(talleres || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

const sumarDias = (iso, dias) => {
    const [y, m, d] = iso.split('-').map(Number);
    const f = new Date(Date.UTC(y, m - 1, d + dias));
    return f.toISOString().slice(0, 10);
};

const diasEntre = (desde, hasta) => {
    const a = Date.UTC(...desde.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0)));
    const b = Date.UTC(...hasta.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0)));
    return Math.round((b - a) / 86400000);
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

// Los talleres contra los que se compara la selección, o null si no hay con qué.
export function talleresAnteriores(talleres, filtro) {
    const ordenados = porFecha(talleres);
    let anteriores = null;
    if (filtro?.modo === 'ultimos') {
        const n = Math.max(1, filtro.n || 1);
        anteriores = ordenados.slice(n, n * 2);
    } else if (filtro?.modo === 'periodo' && filtro.desde && filtro.hasta && filtro.desde <= filtro.hasta) {
        const largo = diasEntre(filtro.desde, filtro.hasta);
        const hasta = sumarDias(filtro.desde, -1);
        anteriores = entre(ordenados, sumarDias(hasta, -largo), hasta);
    }
    return anteriores && anteriores.length ? anteriores : null;
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
