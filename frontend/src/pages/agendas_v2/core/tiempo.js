// Fechas y zonas horarias con Intl, sin librerías. Los instantes son milisegundos UTC.

import { mayus, pad } from './util';

const cache = {};
export function dtf(tz, o, loc) {
    const k = tz + JSON.stringify(o) + (loc || '');
    return cache[k] || (cache[k] = new Intl.DateTimeFormat(loc || 'en-US', { timeZone: tz, ...o }));
}
export function offsetMin(ts, tz) {
    const p = {};
    dtf(tz, { hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(ts).forEach(x => { p[x.type] = x.value; });
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second) - ts) / 60000);
}
// Hora local de una zona → instante UTC. Contempla cambios de horario con un segundo cálculo del desfase.
export function zonedToUtc(y, m, d, h, mi, tz) {
    const g = Date.UTC(y, m, d, h, mi), o1 = offsetMin(g, tz), t = g - o1 * 60000, o2 = offsetMin(t, tz);
    return o2 === o1 ? t : g - o2 * 60000;
}
export function claveDia(ts, tz) { return dtf(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA').format(ts); }
export function horaTxt(ts, tz) { return dtf(tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, 'es').format(ts); }
export function gmtTxt(tz, ahora = Date.now()) {
    let o = offsetMin(ahora, tz); const s = o < 0 ? '-' : '+'; o = Math.abs(o);
    return 'GMT' + s + Math.floor(o / 60) + (o % 60 ? ':' + pad(o % 60) : '');
}
function utcDeClave(k) { const a = k.split('-').map(Number); return Date.UTC(a[0], a[1] - 1, a[2], 12); }
export function fechaCorta(k) { return dtf('UTC', { day: 'numeric', month: 'short' }, 'es').format(utcDeClave(k)); }
export function fechaClave(k) { return mayus(dtf('UTC', { weekday: 'long', day: 'numeric', month: 'long' }, 'es').format(utcDeClave(k))); }
export function fechaTs(ts, tz) { return mayus(dtf(tz, { weekday: 'long', day: 'numeric', month: 'long' }, 'es').format(ts)); }
export function mesTitulo(y, m) { return mayus(dtf('UTC', { month: 'long', year: 'numeric' }, 'es').format(Date.UTC(y, m, 1, 12))); }
export function diaSemana(ts, tz) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dtf(tz, { weekday: 'short' }, 'en-US').format(ts)); }
// Minutos desde la medianoche local.
export function minutoDelDia(ts, tz) {
    const p = {};
    dtf(tz, { hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(ts).forEach(x => { p[x.type] = x.value; });
    return (+p.hour % 24) * 60 + (+p.minute);
}
