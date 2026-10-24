/**
 * Configuración del ranking de Analizar › Comparativas (pedido de la dirección, 24/10/2026).
 *
 * Es de CADA persona (se guarda en su navegador, ver `useRankingConfig`) y solo cambia lo que esa
 * persona ve: el backend sigue mandando todas las métricas y todas las filas. Sin nada guardado,
 * `CONFIG_BASE` reproduce el ranking de siempre: todas las métricas, la primera por defecto, de
 * mayor a menor, sin puntaje compuesto, sin metas y sin filtros.
 *
 * Toda la lógica vive acá (funciones puras) para que el panel y Comparativas solo dibujen.
 */

/** La métrica que agrega el puntaje compuesto: una opción más del selector. */
export const KEY_PUNTAJE = 'puntaje';

export const METRICA_PUNTAJE = {
    key: KEY_PUNTAJE, label: 'Puntaje', formato: 'num', suma: false,
    desc: 'Combina varias métricas con los pesos que elegiste. 100 es el mejor del grupo en todas.',
};

export const CONFIG_BASE = {
    ocultas: [],       // keys de métricas fuera del selector
    inicial: null,     // key de la que se abre primero; null = la primera visible
    orden: 'desc',
    compuesto: false,  // agrega «Puntaje» al selector
    cierre: 'close_rate', // qué lectura del close rate se ve (la clave de la variante)
    pesos: {},         // key -> peso relativo; lo que falte sale de PESOS_BASE
    metas: {},         // key -> meta a alcanzar
    excluidos: [],     // ids de personas fuera del ranking
    minAgendas: 0,
    minVentas: 0,
};

// Pesos con los que arranca el puntaje de cada rol: lo que Kerwin pidió de ejemplo para closers
// (40 cash, 30 close rate, 30 show up) y su equivalente para setters.
export const PESOS_BASE = {
    closers: { cash: 40, close_rate: 30, show_up: 30 },
    setters: { agendas: 30, conversion: 30, show_up: 20, ventas_originadas: 20 },
};

const numeroONulo = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

const mapaNumerico = (raw) => {
    const salida = {};
    if (raw && typeof raw === 'object') {
        Object.entries(raw).forEach(([k, v]) => {
            const n = numeroONulo(v);
            if (n !== null && n >= 0) salida[k] = n;
        });
    }
    return salida;
};

/** Lo guardado puede venir de una versión vieja o tocado a mano: se deja solo lo que sirve. */
export const normalizar = (raw) => {
    const r = raw && typeof raw === 'object' ? raw : {};
    const lista = (v) => (Array.isArray(v) ? v.filter(x => x !== null && x !== undefined) : []);
    return {
        ocultas: lista(r.ocultas).map(String),
        inicial: typeof r.inicial === 'string' ? r.inicial : null,
        orden: r.orden === 'asc' ? 'asc' : 'desc',
        compuesto: r.compuesto === true,
        cierre: typeof r.cierre === 'string' && r.cierre ? r.cierre : 'close_rate',
        pesos: mapaNumerico(r.pesos),
        metas: mapaNumerico(r.metas),
        excluidos: lista(r.excluidos),
        minAgendas: Math.max(0, numeroONulo(r.minAgendas) ?? 0),
        minVentas: Math.max(0, numeroONulo(r.minVentas) ?? 0),
    };
};

/** Cuántas cosas distintas de lo de siempre hay puestas (la burbuja del botón y el «Restablecer»). */
export const cambiosActivos = (c) => [
    c.ocultas.length > 0,
    c.inicial !== null,
    c.orden !== 'desc',
    c.compuesto,
    c.cierre !== 'close_rate',
    Object.keys(c.metas).length > 0,
    c.excluidos.length > 0,
    c.minAgendas > 0,
    c.minVentas > 0,
].filter(Boolean).length;

/**
 * Las lecturas del close rate (por llamada, por presentación, con señas, real) viajan como métricas
 * separadas del backend, pero se ven como UNA: «Close rate» con un desplegable que elige la
 * lectura. Esta función deja esa sola, con el valor de la lectura elegida en cada fila y en el
 * equipo, así el ranking, el mapa, el puntaje y las metas la tratan como cualquier otra métrica
 * (sigue llamándose `close_rate`, la clave de siempre de las configuraciones guardadas).
 */
export const unirCierre = (datos, elegida) => {
    const grupo = datos.metricas.filter(m => m.grupo === 'close_rate');
    if (grupo.length < 2) return datos;
    const sel = grupo.find(m => m.key === elegida) || grupo[0];
    const virtual = {
        key: 'close_rate', label: 'Close rate', formato: 'pct', suma: false,
        etiqueta: `Close rate · ${sel.variante.toLowerCase()}`,
        desc: sel.desc, variante: sel.key,
        variantes: grupo.map(m => ({ key: m.key, label: m.variante })),
    };
    const pegar = (f) => ({
        ...f,
        close_rate: f[sel.key],
        deltas: f.deltas ? { ...f.deltas, close_rate: f.deltas[sel.key] } : f.deltas,
    });
    return {
        ...datos,
        metricas: datos.metricas.flatMap(m => (m.grupo !== 'close_rate' ? [m] : m.key === grupo[0].key ? [virtual] : [])),
        filas: datos.filas.map(pegar),
        equipo: pegar(datos.equipo),
    };
};

/** El peso con el que cuenta una métrica en el puntaje: el elegido o el de arranque del rol. */
export const pesoDe = (config, rol, key) => config.pesos[key] ?? PESOS_BASE[rol]?.[key] ?? 0;

/** Las métricas del selector: sin las ocultas (siempre queda al menos una) y con el puntaje al final. */
export const metricasVisibles = (metricas, config) => {
    const quedan = metricas.filter(m => !config.ocultas.includes(m.key));
    const base = quedan.length ? quedan : metricas.slice(0, 1);
    return config.compuesto ? [...base, METRICA_PUNTAJE] : base;
};

/** Quién entra: sin los excluidos y solo con quienes llegan a los mínimos de agendas y de ventas. */
export const filtrarFilas = (filas, config) => filas.filter(f => {
    if (config.excluidos.includes(f.id)) return false;
    const ventas = f.ventas ?? f.ventas_originadas ?? 0;
    return (f.agendas ?? 0) >= config.minAgendas && ventas >= config.minVentas;
});

/**
 * Puntaje de cada fila: cada métrica con peso se lleva a 0–100 contra la MEJOR del grupo (su valor
 * sobre el máximo) y se promedia con los pesos. Contra el máximo y no entre mínimo y máximo: así
 * 90% y 85% de show up no pasan a ser 100 y 0, que exageraba una diferencia chica.
 *
 * Una métrica sin dato para esa persona (un show up sin llamadas) no cuenta como cero: se promedia
 * sobre las que sí tiene. Una que vale cero para todos no distingue a nadie y se salta.
 */
export const puntajes = (filas, metricas, config, rol) => {
    const usadas = metricas
        .map(m => ({ key: m.key, peso: pesoDe(config, rol, m.key) }))
        .filter(m => m.peso > 0)
        .map(m => ({
            ...m,
            maximo: Math.max(0, ...filas.map(f => f[m.key]).filter(v => v !== null && v !== undefined)),
        }))
        .filter(m => m.maximo > 0);

    const salida = new Map();
    filas.forEach(f => {
        let suma = 0, pesos = 0;
        usadas.forEach(m => {
            const v = f[m.key];
            if (v === null || v === undefined) return;
            suma += (v / m.maximo) * 100 * m.peso;
            pesos += m.peso;
        });
        salida.set(f.id, pesos ? Math.round((suma / pesos) * 10) / 10 : null);
    });
    return salida;
};

/**
 * Lo que dibuja Comparativas: las filas que entran (con su puntaje si hay compuesto), las métricas
 * del selector y el equipo con el promedio del puntaje. Las filas quedan en el orden del backend:
 * ordenar depende de la métrica elegida (`ordenar`).
 *
 * El equipo NO se recalcula sin los excluidos: es lo que el sistema cuenta de todo el equipo. El
 * puntaje del equipo es el promedio de las filas que entran.
 */
export const armarVista = (datos, config) => {
    const metricas = metricasVisibles(datos.metricas, config);
    let filas = filtrarFilas(datos.filas, config);
    let equipo = datos.equipo;
    if (config.compuesto) {
        const mapa = puntajes(filas, datos.metricas, config, datos.rol);
        filas = filas.map(f => ({ ...f, [KEY_PUNTAJE]: mapa.get(f.id) }));
        const validos = filas.map(f => f[KEY_PUNTAJE]).filter(v => v !== null);
        equipo = {
            ...datos.equipo,
            [KEY_PUNTAJE]: validos.length ? Math.round(validos.reduce((a, b) => a + b, 0) / validos.length * 10) / 10 : null,
        };
    }
    return { ...datos, metricas, filas, equipo };
};

/** La métrica que se mira: la elegida en la sesión, si no la inicial de la configuración, si no la primera. */
export const metricaActual = (metricas, elegida, config) => (
    metricas.find(m => m.key === elegida)
    || metricas.find(m => m.key === config.inicial)
    || metricas[0]
);

/** Ordena por la métrica; sin dato siempre al final, sea cual sea el sentido. */
export const ordenar = (filas, key, orden) => [...filas].sort((a, b) => {
    const va = a[key], vb = b[key];
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    return orden === 'asc' ? va - vb : vb - va;
});

/** `true` si llega a la meta, `false` si no, `null` si la métrica no tiene meta. */
export const cumpleMeta = (valor, meta) => {
    if (meta === null || meta === undefined) return null;
    return valor !== null && valor !== undefined && valor >= meta;
};
