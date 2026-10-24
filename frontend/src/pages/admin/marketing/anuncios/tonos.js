/**
 * Los colores de referencia de Rendimiento (Kerwin, 17/10/2026: «necesito colores para identificar qué
 * datos estoy viendo comparados con otros, o en base al promedio»).
 *
 * Cada métrica se compara con la de TODA la tabla visible (la fila «Resultados de…»): verde si es más de
 * un 15% mejor, rojo si es más de un 15% peor, sin color en el medio. Qué es «mejor» depende de la
 * métrica: más calificados es bueno, más costo por lead es malo. Las cantidades sueltas (entrantes,
 * agendas, ventas, cobrado) se comparan con el promedio por fila; el gasto no tiene color: gastar más no
 * es ni bueno ni malo.
 *
 * Una fila con pocos leads no se pinta por sus porcentajes: con 3 leads, 1 calificado es un 33% que no
 * dice nada.
 */

export const UMBRAL = 0.15;
export const MINIMO_DE_LEADS = 10;

/** `campo`: qué valor se compara (el porcentaje, si la columna lo tiene). `por: 'fila'`: contra el
 *  promedio por fila. `muestra`: necesita al menos MINIMO_DE_LEADS entrantes. */
export const REFERENCIA = {
    entrantes: { mejor: 'mas', por: 'fila' },
    calificados: { mejor: 'mas', campo: 'pct_calificados', muestra: true },
    pct_calificados: { mejor: 'mas', muestra: true },
    descalificados: { mejor: 'menos', campo: 'pct_descalificados', muestra: true },
    sin_respuesta: { mejor: 'menos', campo: 'pct_sin_respuesta', muestra: true },
    cpl: { mejor: 'menos', muestra: true },
    cpl_calificado: { mejor: 'menos', muestra: true },
    agendas: { mejor: 'mas', por: 'fila' },
    costo_agenda: { mejor: 'menos' },
    ventas: { mejor: 'mas', por: 'fila' },
    costo_venta: { mejor: 'menos' },
    cobrado: { mejor: 'mas', por: 'fila' },
    roas: { mejor: 'mas' },
};

/** La referencia de cada métrica para las filas dadas: `{ key: número }` (sin las que no tienen). */
export const referenciasDe = (totales, cantidad) => Object.fromEntries(Object.entries(REFERENCIA).flatMap(([key, r]) => {
    const base = r.por === 'fila' ? (cantidad ? (Number(totales[key]) || 0) / cantidad : null) : totales[r.campo || key];
    return base === null || base === undefined || !Number.isFinite(base) ? [] : [[key, base]];
}));

/** 'bien', 'mal' o null para la métrica `key` de la fila. */
export const tonoDe = (fila, key, referencias) => {
    const r = REFERENCIA[key];
    const base = referencias?.[key];
    if (!r || base === undefined) return null;
    if (r.muestra && (fila.entrantes || 0) < MINIMO_DE_LEADS) return null;
    const valor = fila[r.campo || key];
    if (valor === null || valor === undefined) return null;
    if (base === 0) return valor > 0 ? (r.mejor === 'mas' ? 'bien' : 'mal') : null;
    // Si la fila típica no llega a 1 (0,2 ventas por fila), un 0 es lo normal: solo se marca lo que sí tiene.
    if (r.por === 'fila' && base < 1) return valor > base * (1 + UMBRAL) && valor > 0 ? 'bien' : null;
    const diferencia = (valor - base) / Math.abs(base);
    if (Math.abs(diferencia) <= UMBRAL) return null;
    return (diferencia > 0) === (r.mejor === 'mas') ? 'bien' : 'mal';
};

/**
 * El embudo de una fila para las tarjetas: entrantes → calificados → agendas → ventas, con la conversión
 * de cada paso y su color contra la conversión de toda la tabla. Un paso con menos de 5 personas en el
 * anterior no se pinta (2 de 3 no es un 67% que diga algo).
 */
export const PASOS = [
    { key: 'entrantes', label: 'Entrantes' },
    { key: 'calificados', label: 'Calificados' },
    { key: 'agendas', label: 'Agendas' },
    { key: 'ventas', label: 'Ventas' },
];
const MINIMO_DEL_PASO = 5;

export const embudoDe = (fila, totales) => {
    const tope = Number(fila.entrantes) || 0;
    return PASOS.map((paso, i) => {
        const valor = Number(fila[paso.key]) || 0;
        const ancho = tope ? Math.min(1, valor / tope) : 0;
        if (!i) return { ...paso, valor, ancho, conversion: null, referencia: null, tono: null };
        const anterior = Number(fila[PASOS[i - 1].key]) || 0;
        const totalAnterior = Number(totales?.[PASOS[i - 1].key]) || 0;
        const conversion = anterior ? valor / anterior : null;
        const referencia = totalAnterior ? (Number(totales[paso.key]) || 0) / totalAnterior : null;
        let tono = null;
        if (conversion !== null && referencia && anterior >= MINIMO_DEL_PASO) {
            const diferencia = (conversion - referencia) / referencia;
            if (Math.abs(diferencia) > UMBRAL) tono = diferencia > 0 ? 'bien' : 'mal';
        }
        return { ...paso, valor, ancho, conversion, referencia, tono };
    });
};

/** El texto del `title` de una celda con color: «23% mejor que el promedio (64.8%)». */
export const explicacion = (fila, key, referencias, formatear) => {
    const tono = tonoDe(fila, key, referencias);
    if (!tono) return undefined;
    const r = REFERENCIA[key];
    const base = referencias[key];
    const valor = fila[r.campo || key];
    const pct = base ? Math.round(Math.abs((valor - base) / base) * 100) : null;
    const quien = r.por === 'fila' ? 'el promedio por fila' : 'el de la tabla';
    return `${pct !== null ? `${pct}% ` : ''}${tono === 'bien' ? 'mejor' : 'peor'} que ${quien} (${formatear(base, key)})`;
};
