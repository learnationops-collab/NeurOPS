/**
 * Modelo del gráfico de embudo (geometría y derivadas de cada paso).
 *
 * El componente de beui.dev que pidió el usuario importa `./funnel-chart/model`, pero ese
 * archivo no vino con el pegado ni está publicado acá, así que se reconstruye a partir del
 * contrato que el componente usa: `buildFunnel(stages)` devuelve `{ rows, first, last,
 * conversion }`, y cada fila expone `proportion`, `stepConversion`, `conversion` y `change`.
 *
 * Lo único que NO se puede deducir del contrato es la curvatura exacta de las bandas, así que
 * acá es una decisión propia: cada lado del embudo es una cúbica con los puntos de control a
 * media altura de la banda, que da la S suave habitual de este gráfico. Si aparece el `model`
 * original de beui, reemplazar `funnelPath` y nada más — el resto del archivo es aritmética.
 *
 * El lienzo es el que fija el componente: `viewBox="0 0 1000 500"` con
 * `preserveAspectRatio="none"`, o sea coordenadas normalizadas que se estiran al contenedor.
 */

export const ANCHO = 1000;
export const ALTO = 500;

const finitoNoNegativo = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/**
 * Normaliza los pasos y calcula todo lo derivado.
 *
 * Se descartan los pasos sin id, con valor no finito o negativo, y los ids repetidos (se queda
 * el primero) — el mismo criterio que documenta el componente: "ordered stages with finite,
 * nonnegative counts; duplicate IDs are omitted".
 */
export function buildFunnel(stages) {
    const vistos = new Set();
    const limpios = [];
    for (const paso of stages || []) {
        if (!paso || paso.id === undefined || paso.id === null) continue;
        const id = String(paso.id);
        if (vistos.has(id) || !finitoNoNegativo(paso.value)) continue;
        vistos.add(id);
        limpios.push({ ...paso, id, value: paso.value, label: paso.label ?? id });
    }

    if (!limpios.length) {
        return { rows: [], first: 0, last: 0, conversion: null };
    }

    const first = limpios[0].value;
    const last = limpios[limpios.length - 1].value;

    // `proportion` es el ancho relativo de la banda: 1 en el primer paso. Con un primer paso en
    // cero no hay nada que dividir y todas las bandas quedan en cero (el gráfico se ve vacío,
    // que es la verdad), en vez de dar NaN y romper el path.
    const rows = limpios.map((paso, i) => {
        const previo = i > 0 ? limpios[i - 1].value : null;
        return {
            ...paso,
            proportion: first ? paso.value / first : 0,
            // Porcentajes: `null` cuando no hay denominador. El componente los imprime con
            // `percentage()`, que ya muestra "—" para null; un 0% inventado diría que nadie
            // pasó, cuando lo cierto es que no hay con qué medirlo.
            stepConversion: previo === null ? null : (previo ? (paso.value / previo) * 100 : null),
            conversion: first ? (paso.value / first) * 100 : null,
            change: previo === null ? null : paso.value - previo,
        };
    });

    return { rows, first, last, conversion: first ? (last / first) * 100 : null };
}

/** Coordenada del borde de una banda de proporción `p` sobre un eje de largo `largo`. */
const bordes = (p, largo) => {
    const mitad = (Math.max(0, Math.min(1, p)) * largo) / 2;
    const centro = largo / 2;
    return [centro - mitad, centro + mitad];
};

/**
 * Path SVG de la banda `index`.
 *
 * Cada banda va del borde que comparte con la anterior al que comparte con la siguiente, así que
 * dos bandas contiguas describen EXACTAMENTE la misma curva en su frontera: por eso no quedan
 * costuras ni puntas entre pasos (es lo que el componente llama "a shared path interpolation
 * keeps adjacent curved boundaries connected").
 *
 * La última banda cierra recta: no tiene paso siguiente al que estrecharse.
 */
export function funnelPath(proportions, index, direction = 'vertical') {
    const n = proportions?.length || 0;
    if (!n || index < 0 || index >= n) return '';

    const pEntra = proportions[index] || 0;
    const pSale = index < n - 1 ? (proportions[index + 1] || 0) : pEntra;

    if (direction === 'horizontal') {
        // El flujo avanza en X y el ancho de la banda es su ALTO.
        const paso = ANCHO / n;
        const x0 = index * paso;
        const x1 = x0 + paso;
        const medio = x0 + paso / 2;
        const [arribaEntra, abajoEntra] = bordes(pEntra, ALTO);
        const [arribaSale, abajoSale] = bordes(pSale, ALTO);
        return [
            `M ${x0} ${arribaEntra}`,
            `C ${medio} ${arribaEntra} ${medio} ${arribaSale} ${x1} ${arribaSale}`,
            `L ${x1} ${abajoSale}`,
            `C ${medio} ${abajoSale} ${medio} ${abajoEntra} ${x0} ${abajoEntra}`,
            'Z',
        ].join(' ');
    }

    // Vertical: el flujo baja en Y y el ancho de la banda es su ANCHO.
    const paso = ALTO / n;
    const y0 = index * paso;
    const y1 = y0 + paso;
    const medio = y0 + paso / 2;
    const [izqEntra, derEntra] = bordes(pEntra, ANCHO);
    const [izqSale, derSale] = bordes(pSale, ANCHO);
    return [
        `M ${izqEntra} ${y0}`,
        `L ${derEntra} ${y0}`,
        `C ${derEntra} ${medio} ${derSale} ${medio} ${derSale} ${y1}`,
        `L ${izqSale} ${y1}`,
        `C ${izqSale} ${medio} ${izqEntra} ${medio} ${izqEntra} ${y0}`,
        'Z',
    ].join(' ');
}
