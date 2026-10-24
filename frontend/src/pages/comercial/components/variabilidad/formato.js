import { fmt } from '../Shared';

/** El valor de una serie con su unidad: $ 1.250, 61.3% o 4. */
export const valorDe = (serie, v) => {
    if (v === null || v === undefined) return '—';
    if (serie.unidad === '$') return fmt.money(v);
    if (serie.unidad === '%') return `${Number(v).toFixed(1)}%`;
    return fmt.num(Math.round(v));
};

/** Una diferencia con signo: +$1.250, −4.2% o +3. */
export const difDe = (serie, v) => {
    const signo = v > 0 ? '+' : v < 0 ? '−' : '';
    return `${signo}${valorDe(serie, Math.abs(v))}`;
};

export const diaCorto = (iso) => Number(iso.slice(8, 10));

/** «lun 12/10»: el día de la semana importa para leer un pico (¿era un sábado?). */
export const diaConSemana = (iso, nombre) => `${nombre.slice(0, 3)} ${fmt.fecha(iso)}`;
