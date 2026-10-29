import { UMBRAL } from '../anuncios/tonos';
import { GRUPOS_COMPARACION } from '../anuncios/fuentes';
import { formatear } from '../anuncios/metricas';

/**
 * La matriz A/B/C/D × Setting / Workshop de «Todos» (Gabriela, 28/10/2026). Las cuentas las hace el backend
 * (`app/services/segmentos_marketing_service.py`); acá solo se eligen los grupos a ver y se arman los textos.
 *
 * Colores de cada segmento: los de la ficha del lead (A verde, B azul, C ámbar, D magenta); «sin segmento»
 * es un grupo más, en gris: son las agendas viejas de Calendly/n8n y quienes no llenaron el formulario.
 */
export const COLOR_SEGMENTO = {
    A: 'var(--success)', B: 'var(--info)', C: 'var(--warning)', D: 'var(--brand-secondary)', sin: 'var(--text-muted)',
};

// El rótulo y la ayuda de cada columna salen de la comparación de Setting vs Workshop (una sola definición).
const fila = (key) => GRUPOS_COMPARACION.flatMap((g) => g.filas).find((f) => f.key === key);

/** Las columnas de la matriz: `lista` es la lista que abre cada cifra (`fuentes_registros_service.METRICAS`). */
export const COLUMNAS_SEGMENTO = [
    { key: 'leads', label: fila('leads').label, ayuda: fila('leads').ayuda, lista: 'leads' },
    { key: 'agendas', label: fila('agendas').label, ayuda: fila('agendas').ayuda, lista: 'agendas' },
    { key: 'show_up', label: fila('show_up').label, ayuda: fila('show_up').ayuda, lista: 'show_up',
        pct: 'pct_show_up', base: 'reportadas', baseLista: 'reportadas', baseTexto: 'con resultado', mejor: 'mas' },
    { key: 'ventas', label: fila('ventas').label, ayuda: fila('ventas').ayuda, lista: 'ventas',
        pct: 'pct_cierre', base: 'show_up', baseLista: 'show_up', baseTexto: 'que asistieron', mejor: 'mas', pctRotulo: 'cierre' },
    { key: 'new_cash', label: 'New Cash', ayuda: fila('new_cash').ayuda, lista: 'new_cash', dinero: true },
    { key: 'cash_total', label: 'Cash total', ayuda: fila('cash_total').ayuda, lista: 'cash_total', dinero: true,
        pct: 'pct_cash', pctRotulo: 'del cash' },
];

/** Los grupos que se ven: los elegidos en el filtro (`elegidos` vacío = todos), en el orden del backend. */
export const visibles = (filas, elegidos) => (elegidos.length ? filas.filter((f) => elegidos.includes(f.segmento)) : filas);

/** El total de los grupos a la vista: sin filtro es el del backend; con filtro, la suma de las filas elegidas con las
 *  tasas rehechas. Workshop no parte sus leads (clics anónimos): con un filtro quedan sin dato. */
export const totalDe = (filas, total, filtrado) => {
    if (!filtrado) return total;
    const suma = (k) => filas.reduce((a, f) => a + (f[k] || 0), 0);
    const pct = (a, b) => (b ? Number(((a * 100) / b).toFixed(1)) : null);
    const t = { segmento: null, label: 'Total del filtro' };
    ['agendas', 'reportadas', 'show_up', 'ventas', 'new_cash', 'cash_total'].forEach((k) => { t[k] = suma(k); });
    t.leads = filas.some((f) => f.leads !== null) ? suma('leads') : null;
    t.new_cash = Number(t.new_cash.toFixed(2));
    t.cash_total = Number(t.cash_total.toFixed(2));
    t.pct_show_up = pct(t.show_up, t.reportadas);
    t.pct_cierre = pct(t.ventas, t.show_up);
    t.pct_lead_agenda = t.leads ? pct(t.agendas, t.leads) : null;
    t.ticket = t.ventas ? Number((t.new_cash / t.ventas).toFixed(2)) : null;
    t.pct_cash = pct(t.cash_total, total.cash_total);
    return t;
};

/** 'bien' / 'mal' / null: una tasa de un grupo contra la del total (mismo umbral del 15% que `tonos.js`).
 *  Con menos de 5 asistentes o citas con resultado no se pinta: una tasa de 3 personas no dice nada. */
export const tonoDeTasa = (columna, fila, referencia) => {
    if (!columna.mejor || !referencia) return null;
    const valor = fila[columna.pct];
    const base = referencia[columna.pct];
    if (valor === null || valor === undefined || !base || (fila[columna.base] || 0) < 5) return null;
    const diferencia = (valor - base) / Math.abs(base);
    if (Math.abs(diferencia) <= UMBRAL) return null;
    return diferencia > 0 ? 'bien' : 'mal';
};

export const valorDe = (columna, fila, moneda) => {
    const v = fila[columna.key];
    if (v === null || v === undefined) return '—';
    return columna.dinero ? formatear(v, 'money', moneda) : formatear(v, 'num');
};

export const pctDe = (columna, fila) => {
    const v = columna.pct ? fila[columna.pct] : null;
    return v === null || v === undefined ? null : `${v}%`;
};

/** Los segmentos de la URL (`?segmento=A,B`): solo los que existen. */
export const segmentosDeUrl = (texto, segmentos) => {
    const validos = new Set(segmentos.map((s) => s.key));
    return String(texto || '').split(',').filter((s) => validos.has(s));
};
