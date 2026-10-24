import { tocada } from './modelo';

/**
 * Las palancas del Simulador y cómo se agrupan (pedido de Kerwin, 24/10/2026).
 *
 * `unidad` dice cómo se lee el valor de la palanca: `vol` (por día hábil), `pct` (una tasa; el valor
 * absoluto se escribe en %), `money` y `num` (personas). `base(perfil)` es el valor de la línea base
 * en esa unidad. `show_up` está en el embudo del setter y en el del closer: es la MISMA palanca, el
 * estado es uno solo.
 */

export const PALANCAS = {
    entrantes: { label: 'Entrantes', unidad: 'vol', sufijo: ' /día hábil', tip: 'Mensajes nuevos por día hábil, con anuncios e inbound.',
        base: (p) => p.ritmo.entrantes },
    aperturas: { label: 'Aperturas', unidad: 'vol', sufijo: ' /día hábil', tip: 'Conversaciones abiertas por día hábil.',
        base: (p) => p.ritmo.aperturas },
    generadas: { label: 'Agendas generadas', unidad: 'vol', sufijo: ' /día hábil', tip: 'Agendas que reservan los setters, por día hábil.',
        base: (p) => p.ritmo.generadas },
    show_up: { label: 'Show up', unidad: 'pct', tip: 'De las llamadas con resultado, cuántas asistieron.',
        compartida: 'Es la misma palanca en el embudo del setter y del closer.',
        base: (p) => p.showUp * 100 },
    agendas: { label: 'Agendas del closer', unidad: 'vol', sufijo: ' /día hábil', tip: 'Llamadas que reciben los closers, por día hábil.',
        base: (p) => p.ritmo.agendas },
    close_rate: { label: 'Close rate', unidad: 'pct', tip: 'Pago completo + split sobre los que asistieron.',
        base: (p) => p.closeRate * 100 },
    ticket: { label: 'Ticket promedio', unidad: 'money', tip: 'Cobrado por venta nueva, sin señas.',
        base: (p) => p.ticket },
    closers: { label: 'Closers', unidad: 'num', tip: 'Closers que atienden llamadas.',
        base: (p) => p.closers },
    prod_closers: { label: 'Agendas por closer', unidad: 'vol', sufijo: ' /día hábil', tip: 'Llamadas que atiende cada closer por día hábil.',
        base: (p) => p.agendasPorCloser },
    setters: { label: 'Setters', unidad: 'num', tip: 'Setters que generan agendas.',
        base: (p) => p.setters },
    prod_setters: { label: 'Generadas por setter', unidad: 'vol', sufijo: ' /día hábil', tip: 'Agendas que reserva cada setter por día hábil.',
        base: (p) => p.generadasPorSetter },
    gasto: { label: 'Inversión', unidad: 'money', sufijo: ' /día hábil', tip: 'Gasto en anuncios por día hábil (Meta Ads).',
        base: (p) => p.ritmo.gasto },
    cpl: { label: 'Costo por lead', unidad: 'money', tip: 'Gasto ÷ entrantes de anuncios, como en Marketing.',
        base: (p) => p.cpl },
};

export const GRUPOS = [
    { clave: 'setter', titulo: 'Embudo del setter', tip: 'Del mensaje entrante a la agenda reservada.',
        palancas: ['entrantes', 'aperturas', 'generadas', 'show_up'] },
    { clave: 'closer', titulo: 'Embudo del closer', tip: 'De la llamada agendada a la venta.',
        palancas: ['agendas', 'show_up', 'close_rate', 'ticket'] },
    { clave: 'equipo', titulo: 'Equipo', tip: 'Cuántos son y cuánto atiende cada uno: ponen el techo.',
        palancas: ['closers', 'prod_closers', 'setters', 'prod_setters'] },
    { clave: 'anuncios', titulo: 'Anuncios', tip: 'Inversión y costo por lead de Marketing.',
        palancas: ['gasto', 'cpl'] },
];

/** Un número en la unidad de la palanca: `12,4`, `63,2%`, `$1,450`. */
export const textoDe = (unidad, v) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    if (unidad === 'pct') return `${v.toFixed(1)}%`;
    if (unidad === 'money') return `$${Math.round(v).toLocaleString('en-US')}`;
    if (unidad === 'num') return Number.isInteger(v) ? String(v) : v.toFixed(1);
    return v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1);
};

/** El valor que resulta de mover la palanca sobre su base (el de la fila, no el del flujo). */
export const resultadoDe = (def, perfil, palanca) => {
    const base = def.base(perfil);
    if (!tocada(palanca)) return base;
    const v = Number(palanca.valor);
    return Math.max(0, palanca.modo === 'abs' ? v : base * (1 + v / 100));
};

/** Cuántas palancas distintas hay tocadas. */
export const cuantasTocadas = (palancas) => Object.values(palancas).filter(tocada).length;
