/**
 * Formato de fechas de la ficha, en un solo lugar.
 *
 * El backend devuelve fechas en tres formas segun de donde salgan: ISO con hora y microsegundos
 * (`created_at` de un cliente), 'YYYY-MM-DD' pelado (las cuotas, que se guardan como texto) y
 * algunas ya escritas. Cada pestaña las estaba mostrando como venian, asi que en pantalla
 * aparecia `2026-08-19T00:34:51.218225`.
 *
 * Lo que no sea una fecha se devuelve tal cual: antes que un 'Invalid Date', el texto original.
 */

/** Una fecha 'YYYY-MM-DD' se ancla al mediodia para que el huso no la corra un dia. */
const aDate = (v) => new Date(typeof v === 'string' && v.length === 10 ? `${v}T12:00:00` : v);

/** `19 ago 2026`, y con la hora al lado si el dato la trae. */
export const fechaLegible = (v, { conHora = 'auto' } = {}) => {
    if (v === null || v === undefined || v === '') return null;
    const d = aDate(v);
    if (Number.isNaN(d.getTime())) return String(v);
    const dia = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    const traeHora = typeof v === 'string' && v.includes('T') && !v.startsWith(`${v.slice(0, 10)}T00:00:00`);
    if (conHora === false || (conHora === 'auto' && !traeHora)) return dia;
    return `${dia} · ${d.toTimeString().slice(0, 5)}`;
};

/** Solo el dia, sin hora: para «Ingresó» o «Último pago», donde la hora es ruido. */
export const soloDia = (v) => fechaLegible(v, { conHora: false });

export default fechaLegible;
