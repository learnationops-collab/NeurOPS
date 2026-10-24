// Matemática y formato de la pestaña Correlaciones. Los números vienen calculados del backend
// (`/workshop/correlaciones`); acá solo se ordena, se pinta y se explica.

export const METODOS = [
    { value: 'pearson', label: 'Pearson' },
    { value: 'spearman', label: 'Spearman' },
];

export const TIP_METODO = 'Pearson mide rectas; Spearman, si suben juntas (aguanta valores extremos).';

const CONFIANZA = {
    insuficiente: 'Faltan talleres',
    baja: 'Poco confiable',
    media: 'Algo confiable',
    alta: 'Confiable',
};
export const etiquetaConfianza = (c) => CONFIANZA[c] || '';

export const FUERZA = { fuerte: 'fuerte', moderada: 'moderada', 'débil': 'débil', nula: 'casi nula' };

/** Set de «a|b» (en ambos órdenes) con las parejas que se parecen por cómo se calculan. */
export const setLigadas = (ligadas) => new Set((ligadas || []).flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));

export const TIP_LIGADA = 'Se parecen por cómo se calculan, no por lo que pasa en el negocio.';

/** Valor de la celda según el método elegido (null si no se pudo calcular). */
export const valorDe = (celda, metodo) => (celda ? celda[metodo] ?? null : null);

export const intensidadDe = (r) => {
    if (r == null) return null;
    const a = Math.abs(r);
    if (a >= 0.7) return 'fuerte';
    if (a >= 0.4) return 'moderada';
    if (a >= 0.2) return 'débil';
    return 'nula';
};

/** «+0.62» / «−0.35» (con el signo menos tipográfico); «–» si no hay cálculo. */
export const formatoR = (r) => {
    if (r == null) return '–';
    const t = Math.abs(r).toFixed(2);
    if (r > 0) return `+${t}`;
    return r < 0 ? `−${t}` : t;
};

/** Color de relleno de una celda: verde si suben juntas, rojo si una sube y la otra baja. */
export const colorCelda = (r) => {
    if (r == null) return 'transparent';
    const alfa = Math.round(Math.min(1, Math.abs(r)) * 78);
    return `color-mix(in srgb, var(${r >= 0 ? '--success' : '--error'}) ${alfa}%, transparent)`;
};

/** Las demás métricas ordenadas por |r| contra `objetivo`; las sin cálculo van al final. */
export function rankingContra(matriz, objetivo, metodo) {
    const fila = matriz?.[objetivo];
    if (!fila) return [];
    return Object.entries(fila)
        .filter(([clave]) => clave !== objetivo)
        .map(([key, celda]) => ({ key, celda, r: valorDe(celda, metodo) }))
        .sort((a, b) => (a.r == null) - (b.r == null) || Math.abs(b.r ?? 0) - Math.abs(a.r ?? 0));
}

/** Puntos de un par: solo los talleres donde las dos métricas existen. */
export function puntosDelPar(talleres, a, b) {
    return (talleres || [])
        .filter((t) => t.valores[a] != null && t.valores[b] != null)
        .map((t) => ({ id: t.id, nombre: t.name, fecha: t.date, x: t.valores[a], y: t.valores[b] }));
}

/** Recta de mínimos cuadrados; null si no hay al menos 2 puntos o x es constante. */
export function recta(puntos) {
    const n = puntos.length;
    if (n < 2) return null;
    const mx = puntos.reduce((s, p) => s + p.x, 0) / n;
    const my = puntos.reduce((s, p) => s + p.y, 0) / n;
    const sxx = puntos.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    if (sxx === 0) return null;
    const pendiente = puntos.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
    return { pendiente, ordenada: my - pendiente * mx };
}

const NUM = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** Valor de una métrica según su formato (`pct`, `usd` o `numero`). */
export function formatoValor(v, formato) {
    if (v == null) return '–';
    if (formato === 'pct') return `${NUM.format(v)}%`;
    if (formato === 'usd') return `$${NUM.format(v)}`;
    return NUM.format(v);
}

/** Frase honesta para un par: describe el patrón sin afirmar que uno cause el otro. */
export function frasePar(labelA, labelB, celda, metodo) {
    const r = valorDe(celda, metodo);
    if (celda?.n != null && celda.n < 3) return `Con ${celda.n} talleres no se puede calcular.`;
    if (celda?.constante) return 'Una de las dos no cambia entre talleres: no hay qué comparar.';
    if (r == null) return 'No se pudo calcular.';
    const nivel = intensidadDe(r);
    if (nivel === 'nula') return `${labelA} y ${labelB} casi no se mueven juntos (r ${formatoR(r)}).`;
    const sentido = r > 0 ? 'suben y bajan juntos' : 'cuando uno sube, el otro tiende a bajar';
    return `Relación ${FUERZA[nivel]}: ${sentido} (r ${formatoR(r)}). No prueba que uno cause el otro.`;
}
