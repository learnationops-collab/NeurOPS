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

import { parseUtcIso } from '../../../utils/datetime';

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

/**
 * La hora de una AGENDA en el reloj de quien mira: `19 ago 2026 · 14:00`.
 *
 * `start_time` se guarda en UTC y el backend lo manda con `isoformat()`, sin la Z. `fechaLegible`
 * arma el `Date` tal cual, y un ISO sin zona el navegador lo toma como hora LOCAL: la ficha
 * mostraba la hora UTC como si fuera la de La Paz, cuatro horas corrida respecto del mazo y del
 * contador. `parseUtcIso` es la conversión que usa el resto de la app para esta misma columna.
 *
 * El día se arma a mano (`2 oct 2026`, como `_fecha_larga` del backend) y no con
 * `toLocaleDateString('es-AR')`, que da «2 de oct de 2026»: con la hora al lado no entraba en la
 * columna de la fecha y se partía en dos renglones.
 */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dos = (n) => String(n).padStart(2, '0');

export const instanteLegible = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const d = parseUtcIso(String(v));
    if (!d) return String(v);
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};

export default fechaLegible;
