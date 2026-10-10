// Consultas sobre las colecciones. `d` es {funnels, formularios, personas, grupos, eventos, roles}, ya normalizado.

import { COLORES, TZ_DEF, aMin } from './catalogos';
import { mayus } from './util';

export function buscar(d, col, id) { return id ? (d[col] || []).find(x => x.id === id) : undefined; }
export function ord(d, col) {
    return (d[col] || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0) || String(a.nombre).localeCompare(String(b.nombre)));
}
export function maxOrden(d, col) { return (d[col] || []).reduce((m, f) => Math.max(m, f.orden || 0), 0); }

// Un rol que "toma llamadas" es closer; sin roles cargados, vale el id clásico.
// [duración, margen] en minutos de las sesiones de ese closer en ese evento: lo que él ajustó o, si no
// ajustó, la propuesta del evento (duracion, margen).
export function sesionDe(p, eventoId, duracion, margen) {
    const propia = (eventoId && p && p.sesiones && p.sesiones[eventoId]) || {};
    return [propia.duracion ?? duracion, propia.margen ?? (margen || 0)];
}
export function esCloser(d, p) { const r = buscar(d, 'roles', p.rol); return r ? r.atiende : p.rol === 'closer'; }
export function closers(d) { return ord(d, 'personas').filter(p => esCloser(d, p)); }
export function setters(d) {
    return ord(d, 'personas').filter(p => { const r = buscar(d, 'roles', p.rol); return r ? /setter/i.test(r.nombre) : p.rol === 'setter'; });
}
export function nombreRol(d, id) { const r = buscar(d, 'roles', id); return r ? r.nombre : id ? mayus(id) : ''; }
export function nombreGrupo(d, id) { const g = buscar(d, 'grupos', id); return g ? g.nombre : 'sin estrategia'; }
export function colorVar(k) { return 'var(--fc-' + (COLORES.includes(k) ? k : 'azul') + ')'; }
export function colorRol(r) { return r && r.color ? colorVar(r.color) : r && r.atiende ? 'var(--success)' : 'var(--info)'; }
export function colorLibre(d, col) {
    const us = (d[col] || []).map(f => f.color);
    return COLORES.find(c => !us.includes(c)) || COLORES[(d[col] || []).length % COLORES.length];
}
// Rol de closer para sumar personas desde Team: el primero que atiende llamadas, o el id clásico.
export function rolCloser(d) { const r = ord(d, 'roles').find(x => x.atiende); return r ? r.id : 'closer'; }

export function horasSemana(p) {
    let m = 0;
    for (let dd = 0; dd < 7; dd++) ((p.horario || {})[dd] || []).forEach(r => { m += Math.max(0, aMin(r[1]) - aMin(r[0])); });
    return m / 60;
}
// La zona más común del equipo: la que usa la vista de cobertura.
export function tzEquipo(cs) {
    const c = {};
    cs.forEach(p => { c[p.tz] = (c[p.tz] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || TZ_DEF;
}
// Nombre que se muestra para un origen de funnel, y su slug en el link (?o=...).
export function nombreOrigen(d, o) { const p = o.setter && buscar(d, 'personas', o.setter); return p ? p.nombre : o.nombre; }
