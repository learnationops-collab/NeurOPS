// Cálculos puros de Team: la cobertura semanal (Available), las franjas del horario y el texto
// de cada estrategia. Sin React, para poder probarlos.

import { DIAS, aMin } from '../../core/catalogos';
import { VENTANA_LLENAR_DIAS, miembrosValidos } from '../../core/asignacion';
import { buscar, tzEquipo } from '../../core/datos';
import { claveDia, minutoDelDia, zonedToUtc } from '../../core/tiempo';
import { pad } from '../../core/util';

const DIA_MS = 86400000;
export const PASO_CELDA = 60;   // cada celda del carril es una hora posible de llamada
export const DUR_CELDA = 45;    // y dibuja una llamada de 45 min
export const HPX = 46;          // alto de una hora en la grilla
export const MAX_FRANJAS = 6;

// Minutos → "HH:MM" (24:00 incluido).
export function hmTxt(m) { m = Math.max(0, Math.min(1440, m)); return m === 1440 ? '24:00' : pad(Math.floor(m / 60)) + ':' + pad(m % 60); }

// Une franjas que se pisan o se tocan, descarta las vacías y deja como mucho 6, ordenadas.
export function avUnir(rs) {
    const ok = (rs || []).filter(r => aMin(r[1]) > aMin(r[0])).sort((x, y) => aMin(x[0]) - aMin(y[0]));
    const out = [];
    ok.forEach(r => {
        const u = out[out.length - 1];
        if (u && aMin(r[0]) <= aMin(u[1])) { if (aMin(r[1]) > aMin(u[1])) u[1] = r[1]; }
        else out.push([r[0], r[1]]);
    });
    return out.slice(0, MAX_FRANJAS);
}

// Horario lunes a viernes de 9 a 18.
export function horarioLaV() {
    const h = {};
    for (let d = 0; d < 7; d++) h[d] = d >= 1 && d <= 5 ? [['09:00', '18:00']] : [];
    return h;
}

export function nombreDia(dow) { const x = DIAS.find(d => d.d === dow); return x ? x.n : ''; }

/**
 * Cobertura de una semana. Cada closer es un carril; dentro de su horario, cada celda está
 * agendada (hay una reserva real que empieza en esa hora) o libre. Un hueco es una franja del
 * día sin ningún closer.
 * o: {todos: closers con horario, cs: carriles que se muestran, semana: desplazamiento,
 *     ahora, reservasDe(personaId) → [{inicio_ms, fin_ms}], edit}
 */
export function calcularCobertura({ todos, cs, semana = 0, ahora = Date.now(), reservasDe = () => [], edit = false }) {
    const tz = tzEquipo(cs), hoy = claveDia(ahora, tz).split('-').map(Number);
    const dHoy = Date.UTC(hoy[0], hoy[1] - 1, hoy[2]);
    const lunes = dHoy - ((new Date(dHoy).getUTCDay() + 6) % 7) * DIA_MS + semana * 7 * DIA_MS;
    const dias = [];
    for (let i = 0; i < 7; i++) { const d = new Date(lunes + i * DIA_MS); dias.push({ k: d.toISOString().slice(0, 10), d }); }
    const claves = dias.map(x => x.k);

    const gente = todos.slice();
    cs.forEach(p => { if (!gente.includes(p)) gente.push(p); });
    const todosBloques = [];
    gente.forEach(p => {
        const li = cs.indexOf(p);
        const rs = reservasDe(p.id);
        for (let j = -1; j < 8; j++) {
            const b = new Date(lunes + j * DIA_MS), dow = b.getUTCDay();
            ((p.horario || {})[dow] || []).forEach((r, ri) => {
                const a = aMin(r[0]);
                const t0 = zonedToUtc(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), Math.floor(a / 60), a % 60, p.tz);
                const t1 = t0 + (aMin(r[1]) - a) * 60000;
                if (t1 <= t0) return;
                const di = claves.indexOf(claveDia(t0, tz));
                if (di < 0) return;
                const celdas = [];
                for (let t = t0; t + DUR_CELDA * 60000 <= t1; t += PASO_CELDA * 60000) {
                    const fin = t + PASO_CELDA * 60000;
                    celdas.push({ t, oc: rs.some(x => x.inicio_ms >= t && x.inicio_ms < fin) });
                }
                const m0 = minutoDelDia(t0, tz), m1 = m0 + (t1 - t0) / 60000;
                todosBloques.push({ p, li, di, m0, m1: Math.min(m1, 1440), t0, t1, celdas, dow, ri });
            });
        }
    });
    const bloques = todosBloques.filter(x => x.li >= 0);

    let minH = 24, maxH = 0;
    todosBloques.forEach(x => { minH = Math.min(minH, Math.floor(x.m0 / 60)); maxH = Math.max(maxH, Math.ceil(x.m1 / 60)); });
    minH = Math.max(0, minH - 1); maxH = Math.min(24, maxH + 1);
    if (edit) { minH = Math.min(minH, 6); maxH = 24; }
    if (maxH <= minH) { minH = 8; maxH = 20; }

    // Métricas
    let hDisp = 0, agendadas = 0, celdas = 0;
    bloques.forEach(x => { hDisp += (x.m1 - x.m0) / 60; x.celdas.forEach(c => { celdas++; if (c.oc) agendadas++; }); });
    const huecos = [];
    let hHueco = 0;
    const ventana = [Infinity, 0];
    todosBloques.forEach(x => { ventana[0] = Math.min(ventana[0], x.m0); ventana[1] = Math.max(ventana[1], x.m1); });
    dias.forEach((dd, di) => {
        const cub = [];
        for (let m = ventana[0]; m < ventana[1]; m += 30) cub.push(todosBloques.some(x => x.di === di && x.m0 <= m && x.m1 >= m + 30));
        let ini = null;
        cub.concat([true]).forEach((c, idx) => {
            const m = ventana[0] + idx * 30;
            if (!c && ini == null) ini = m;
            if (c && ini != null) { huecos.push({ di, m0: ini, m1: m }); hHueco += (m - ini) / 60; ini = null; }
        });
    });
    const porDia = dias.map((dd, di) => {
        let a = 0, t = 0;
        bloques.filter(x => x.di === di).forEach(x => x.celdas.forEach(c => { t++; if (c.oc) a++; }));
        return { a, t };
    });
    return {
        tz, dias, bloques, huecos, porDia, minH, maxH, hoyK: claveDia(ahora, tz), mAhora: minutoDelDia(ahora, tz),
        kpi: { hDisp, agendadas, celdas, ocupacion: celdas ? agendadas / celdas : 0, hHueco },
    };
}

// Qué pasa con los leads de una prioridad, en una línea.
export function textoEstrategia(d, g) {
    const ns = g.miembros.map(id => { const p = buscar(d, 'personas', id); return p ? p.nombre : ''; }).filter(Boolean);
    if (!ns.length) return 'Sumá closers.';
    if (ns.length === 1) return 'Todo va a ' + ns[0] + '.';
    if (g.estrategia === 'repartir') return 'Cada horario va a quien tenga menos agendas por delante.';
    if (g.estrategia === 'horario') return 'Cada horario va a ' + ns[0] + '; si está ocupado, a ' + ns[1] + (ns.length > 2 ? ' y así.' : '.');
    return ns[0] + ' recibe todo mientras tenga lugar en los próximos ' + VENTANA_LLENAR_DIAS + ' días; después ' + ns[1] + (ns.length > 2 ? ' y así.' : '.');
}

// Aviso de la prioridad cuando ningún miembro puede recibir leads.
export function avisoPrioridad(d, g) {
    const ms = g.miembros.map(id => buscar(d, 'personas', id)).filter(Boolean);
    if (!ms.length || miembrosValidos(d, g).length) return '';
    return 'Nadie tiene horario: los leads pasan a la siguiente estrategia con lugar y, si no hay, a todos los closers.';
}
