/**
 * El desglose de Meta Ads (Kerwin, 16/10/2026: «desglosar por anuncios, no solo por campañas»):
 * Campaña › Conjunto › Anuncio con las métricas sumadas en cada nivel, armado en el cliente con los
 * anuncios de `GET /api/marketing/anuncios/meta` (cada uno con su gasto, impresiones y clics del
 * período y los ids de su campaña y su conjunto).
 *
 * Las mismas cuentas que Rendimiento › Workshop (`workshop_meta_service._metricas`): CTR = clics ÷
 * impresiones (todos los clics), CPC = gasto ÷ clics en el enlace, CPM = gasto ÷ impresiones × 1000.
 *
 * Leads: los entrantes de la palabra clave de ManyChat de cada anuncio (Rendimiento). Un grupo suma
 * cada palabra clave UNA vez aunque la lleven varios de sus anuncios; no se reparten entre anuncios
 * porque ManyChat no dice de qué anuncio vino el lead.
 *
 * El estado de una campaña o un conjunto sale de sus anuncios: el `effective_status` de un anuncio
 * ya dice si su conjunto o su campaña están pausados (ADSET_PAUSED, CAMPAIGN_PAUSED).
 */

const SUMABLES = ['gasto', 'impresiones', 'clics', 'clics_enlace'];

export const conMetricas = (n) => ({
    ...n,
    gasto: Math.round((n.gasto || 0) * 100) / 100,
    ctr: n.impresiones ? (n.clics / n.impresiones) * 100 : null,
    cpc: n.clics_enlace ? n.gasto / n.clics_enlace : null,
    cpm: n.impresiones ? (n.gasto / n.impresiones) * 1000 : null,
});

export const estadoDeGrupo = (anuncios, tipo) => {
    if (anuncios.some((a) => a.estado === 'ACTIVE')) return 'ACTIVE';
    const pausas = tipo === 'campana' ? ['CAMPAIGN_PAUSED'] : ['ADSET_PAUSED', 'CAMPAIGN_PAUSED'];
    if (anuncios.some((a) => pausas.includes(a.estado))) return 'PAUSED';
    if (anuncios.length && anuncios.every((a) => a.estado === 'DISAPPROVED')) return 'DISAPPROVED';
    if (anuncios.some((a) => a.estado === 'WITH_ISSUES' || a.estado === 'DISAPPROVED')) return 'WITH_ISSUES';
    return 'INACTIVO';
};

const sumar = (anuncios, leadsPorClave) => {
    const suma = Object.fromEntries(SUMABLES.map((k) => [k, 0]));
    anuncios.forEach((a) => SUMABLES.forEach((k) => { suma[k] += Number(a[k]) || 0; }));
    const claves = [...new Set(anuncios.map((a) => a.clave).filter(Boolean))].sort();
    const embudos = {};
    anuncios.forEach((a) => { const e = a.embudo || null; embudos[e] = (embudos[e] || 0) + 1; });
    return {
        ...suma,
        anuncios: anuncios.length,
        activos: anuncios.filter((a) => a.estado === 'ACTIVE').length,
        claves,
        embudos,
        leads: claves.length ? claves.reduce((s, c) => s + (leadsPorClave[c] || 0), 0) : null,
    };
};

const agrupar = (lista, clave) => {
    const grupos = new Map();
    lista.forEach((a) => {
        const k = clave(a);
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(a);
    });
    return grupos;
};

/** [campaña] con `hijos` = [conjunto] con `hijos` = [anuncio]; cada nodo con `tipo`, `key`, `nombre`,
 * `estado`, las ids para los enlaces a Meta y sus métricas. */
export const armarDesglose = (anuncios, leadsPorClave = {}) => {
    const porCampana = agrupar(anuncios || [], (a) => a.campana_id || `n:${a.campana || ''}`);
    return [...porCampana.entries()].map(([kc, deCampana]) => {
        const porConjunto = agrupar(deCampana, (a) => a.conjunto_id || `n:${a.conjunto || ''}`);
        const hijos = [...porConjunto.entries()].map(([ks, deConjunto]) => ({
            ...conMetricas(sumar(deConjunto, leadsPorClave)),
            tipo: 'conjunto',
            key: `${kc}›${ks}`,
            nombre: deConjunto[0].conjunto || 'Sin conjunto',
            estado: estadoDeGrupo(deConjunto, 'conjunto'),
            cuenta_id: deConjunto[0].cuenta_id,
            campana_id: deConjunto[0].campana_id,
            conjunto_id: deConjunto[0].conjunto_id,
            hijos: deConjunto.map((a) => ({
                ...conMetricas(a),
                tipo: 'anuncio',
                key: `ad:${a.meta_ad_id}`,
                anuncios: 1,
                activos: a.estado === 'ACTIVE' ? 1 : 0,
                claves: a.clave ? [a.clave] : [],
                embudos: { [a.embudo || null]: 1 },
                leads: a.clave ? (leadsPorClave[a.clave] || 0) : null,
                anuncio: a,
            })),
        }));
        return {
            ...conMetricas(sumar(deCampana, leadsPorClave)),
            tipo: 'campana',
            key: kc,
            nombre: deCampana[0].campana || 'Sin campaña',
            estado: estadoDeGrupo(deCampana, 'campana'),
            cuenta_id: deCampana[0].cuenta_id,
            campana_id: deCampana[0].campana_id,
            hijos,
        };
    });
};

export const totalDelDesglose = (anuncios, leadsPorClave = {}) => conMetricas(sumar(anuncios || [], leadsPorClave));

const comparar = (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'es', { numeric: true });
};

/** El árbol ordenado en cada nivel por `valor(nodo)`; los vacíos, siempre al final. */
export const ordenarDesglose = (nodos, valor, dir = 'desc') => {
    const signo = dir === 'asc' ? 1 : -1;
    return [...nodos]
        .sort((a, b) => {
            const va = valor(a);
            const vb = valor(b);
            if (va == null || vb == null) return comparar(va, vb);
            return signo * comparar(va, vb);
        })
        .map((n) => (n.hijos ? { ...n, hijos: ordenarDesglose(n.hijos, valor, dir) } : n));
};

/** Todas las claves de los nodos con hijos (para «Abrir todo»). */
export const clavesAbribles = (nodos) => nodos.flatMap((n) => (n.hijos?.length && n.tipo !== 'anuncio'
    ? [n.key, ...clavesAbribles(n.hijos)] : []));
