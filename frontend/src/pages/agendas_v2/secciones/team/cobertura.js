// Cálculos puros de Team: la cobertura semanal (Available), las franjas del horario y el texto
// de cada estrategia. Sin React, para poder probarlos.

import { DIAS, aMin } from '../../core/catalogos';
import { VENTANA_LLENAR_DIAS, miembrosValidos } from '../../core/asignacion';
import { buscar, tzEquipo } from '../../core/datos';
import { claveDia, minutoDelDia, zonedToUtc } from '../../core/tiempo';
import { pad } from '../../core/util';

const DIA_MS = 86400000;
export const HPX = 60;          // alto de una hora en la grilla
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

// Minutos → "45 min", "2 h", "2 h 15".
export function durTxt(m) {
    m = Math.round(m);
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + pad(m % 60) : '');
}

// Tramos [inicio, fin] (ms) ordenados y sin superponerse: lo que se pisa o se toca queda en uno.
export function unirTramos(ts) {
    const out = [];
    ts.filter(t => t[1] > t[0]).sort((x, y) => x[0] - y[0]).forEach(([a, b]) => {
        const u = out[out.length - 1];
        if (u && a <= u[1]) u[1] = Math.max(u[1], b); else out.push([a, b]);
    });
    return out;
}
// Lo de unos tramos unidos que cae dentro de [t0, t1].
function recortar(ts, t0, t1) { return ts.map(([a, b]) => [Math.max(a, t0), Math.min(b, t1)]).filter(([a, b]) => b > a); }
// Lo de `ts` que no cae en `menos` (los dos unidos).
function restar(ts, menos) {
    const out = [];
    ts.forEach(([a, b]) => {
        let cur = a;
        for (const [c, d] of menos) {
            if (d <= cur) continue;
            if (c >= b) break;
            if (c > cur) out.push([cur, c]);
            cur = Math.max(cur, d);
        }
        if (cur < b) out.push([cur, b]);
    });
    return out;
}
// Lado a lado lo que se pisa, como en Google Calendar: a cada tarjeta {a, b} le pone su columna (`col`)
// y cuántas columnas tiene el grupo de tarjetas que se pisan entre sí (`ncols`). Devuelve las mismas, ordenadas.
export function columnas(items) {
    const xs = items.slice().sort((x, y) => x.a - y.a || y.b - x.b);
    let grupo = [], finGrupo = -Infinity;
    const cerrar = () => { const n = grupo.reduce((m, x) => Math.max(m, x.col + 1), 0); grupo.forEach(x => { x.ncols = n; }); grupo = []; };
    xs.forEach(x => {
        if (x.a >= finGrupo) { cerrar(); finGrupo = -Infinity; }
        const ocupadas = grupo.filter(y => y.b > x.a).map(y => y.col);
        let c = 0;
        while (ocupadas.includes(c)) c++;
        x.col = c;
        grupo.push(x);
        finGrupo = Math.max(finGrupo, x.b);
    });
    cerrar();
    return xs;
}
const largoMin = (ts) => ts.reduce((s, [a, b]) => s + b - a, 0) / 60000;

// La semana que se ve: su zona (`tz`, o la que más se repite entre esos closers), su lunes (fecha UTC) y
// el rango de instantes a pedir a Google (un día de margen a cada lado: los horarios de otras zonas
// pueden caer en el día vecino).
export function rangoSemana(cs, semana = 0, ahora = Date.now(), tz = null) {
    tz = tz || tzEquipo(cs);
    const hoy = claveDia(ahora, tz).split('-').map(Number);
    const dHoy = Date.UTC(hoy[0], hoy[1] - 1, hoy[2]);
    const lunes = dHoy - ((new Date(dHoy).getUTCDay() + 6) % 7) * DIA_MS + semana * 7 * DIA_MS;
    return { tz, lunes, desde: lunes - DIA_MS, hasta: lunes + 8 * DIA_MS };
}

/**
 * Cobertura de una semana. Cada closer es un carril; dentro de su horario se mide en minutos cuánto
 * está ocupado: la unión de sus reservas y de lo que tiene en Google Calendar, recortada al horario
 * (lo que se pisa cuenta una vez y lo de fuera del horario no cuenta). Lo ocupado se parte en
 * agendado (reservas), margen (lo que el closer se deja después de cada una) y por eventos (lo de
 * Google que no es una reserva ni su margen), así las partes suman el total. Un hueco es una franja del
 * día sin ningún closer.
 * o: {todos: closers con horario, cs: carriles que se muestran, semana: desplazamiento, ahora,
 *     reservasDe(personaId) → [{inicio_ms, fin_ms, margen_min}],
 *     googleDe(personaId) → {estado: 'ok' | 'error' | 'sin_google' | 'sin_usuario', franjas, eventos} | null, edit}
 * Cada tramo por eventos lleva los eventos de Google que lo forman ({inicio, fin, titulo}), para mostrarlos.
 * Para dibujar, cada bloque trae además `items`: cada agenda, cada margen y cada evento por separado
 * (recortados al horario y con su columna si se pisan, ver columnas). Un evento de Google que cae entero
 * en una agenda o su margen no va: es el de la propia agenda.
 * Un closer cuyo calendario no se pudo leer ('error') queda fuera de la ocupación: no se sabe.
 * tz: en qué zona se muestra (la de quien mira); sin ella, la que más se repite entre los closers.
 */
export function calcularCobertura({ todos, cs, semana = 0, ahora = Date.now(), reservasDe = () => [], googleDe = () => null, edit = false, tz = null }) {
    const { tz: zona, lunes } = rangoSemana(cs, semana, ahora, tz);
    tz = zona;
    const dias = [];
    for (let i = 0; i < 7; i++) { const d = new Date(lunes + i * DIA_MS); dias.push({ k: d.toISOString().slice(0, 10), d }); }
    const claves = dias.map(x => x.k);

    const gente = todos.slice();
    cs.forEach(p => { if (!gente.includes(p)) gente.push(p); });
    const todosBloques = [];
    gente.forEach(p => {
        const li = cs.indexOf(p);
        const rs = reservasDe(p.id);
        const finDe = (x) => (x.fin_ms != null ? x.fin_ms : x.inicio_ms + 3600000);
        const ag = unirTramos(rs.map(x => [x.inicio_ms, finDe(x)]));
        const mg = unirTramos(rs.filter(x => x.margen_min > 0).map(x => [finDe(x), finDe(x) + x.margen_min * 60000]));
        const g = googleDe(p.id);
        const ev = unirTramos(g && g.estado === 'ok' ? (g.franjas || []).map(f => [f[0], f[1]]) : []);
        const sinLeer = !!g && g.estado === 'error';
        const eventos = g && g.estado === 'ok' ? (g.eventos || []) : [];
        // Sin el detalle de los eventos, cada franja ocupada es uno sin título.
        const tarjetasEv = eventos.length ? eventos : ev.map(([a, b]) => ({ inicio: a, fin: b, titulo: null }));
        for (let j = -1; j < 8; j++) {
            const b = new Date(lunes + j * DIA_MS), dow = b.getUTCDay();
            ((p.horario || {})[dow] || []).forEach((r, ri) => {
                const a = aMin(r[0]);
                const t0 = zonedToUtc(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), Math.floor(a / 60), a % 60, p.tz);
                const t1 = t0 + (aMin(r[1]) - a) * 60000;
                if (t1 <= t0) return;
                const di = claves.indexOf(claveDia(t0, tz));
                if (di < 0) return;
                const enAg = recortar(ag, t0, t1), enMg = restar(recortar(mg, t0, t1), enAg);
                const enEv = restar(restar(recortar(ev, t0, t1), enAg), enMg);
                const segs = enAg.map(([s0, s1]) => ({ a: s0, b: s1, tipo: 'ag', reservas: rs.filter(r => r.inicio_ms < s1 && finDe(r) > s0) }))
                    .concat(enMg.map(([s0, s1]) => ({ a: s0, b: s1, tipo: 'mg' })))
                    .concat(enEv.map(([s0, s1]) => ({ a: s0, b: s1, tipo: 'ev', eventos: eventos.filter(e => e.inicio < s1 && e.fin > s0) })))
                    .sort((x, y) => x.a - y.a);
                const tapado = unirTramos(enAg.concat(enMg));
                const items = columnas(rs.map(r => ({ tipo: 'ag', a: Math.max(r.inicio_ms, t0), b: Math.min(finDe(r), t1), reserva: r }))
                    .concat(enMg.map(([s0, s1]) => ({ tipo: 'mg', a: s0, b: s1 })))
                    .concat(tarjetasEv.map(e => ({ tipo: 'ev', a: Math.max(e.inicio, t0), b: Math.min(e.fin, t1), evento: e }))
                        .filter(x => x.b > x.a && restar([[x.a, x.b]], tapado).length > 0))
                    .filter(x => x.b > x.a));
                const m0 = minutoDelDia(t0, tz), m1 = m0 + (t1 - t0) / 60000;
                todosBloques.push({
                    p, li, di, m0, m1: Math.min(m1, 1440), t0, t1, dow, ri, segs, items, sinLeer,
                    mDisp: (t1 - t0) / 60000, mAg: largoMin(enAg), mMg: largoMin(enMg), mEv: largoMin(enEv),
                    nAg: rs.filter(x => x.inicio_ms >= t0 && x.inicio_ms < t1).length,
                });
            });
        }
    });
    const bloques = todosBloques.filter(x => x.li >= 0);

    let minH = 24, maxH = 0;
    todosBloques.forEach(x => { minH = Math.min(minH, Math.floor(x.m0 / 60)); maxH = Math.max(maxH, Math.ceil(x.m1 / 60)); });
    minH = Math.max(0, minH - 1); maxH = Math.min(24, maxH + 1);
    // Editando, lugar para crear franjas nuevas alrededor de lo que ya hay.
    if (edit) { minH = Math.min(minH, 8); maxH = Math.max(maxH, 21); }
    if (maxH <= minH) { minH = 8; maxH = 20; }

    // Métricas (en minutos). Agendado incluye el margen de cada agenda. La ocupación se mide solo sobre lo que se sabe.
    let mDisp = 0, mAg = 0, mMg = 0, mEv = 0, nAg = 0, mBase = 0, mAgBase = 0, mEvBase = 0;
    bloques.forEach(x => {
        mDisp += x.mDisp; mAg += x.mAg + x.mMg; mMg += x.mMg; mEv += x.mEv; nAg += x.nAg;
        if (!x.sinLeer) { mBase += x.mDisp; mAgBase += x.mAg + x.mMg; mEvBase += x.mEv; }
    });
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
    // Por día: minutos ocupados (a) de los disponibles (t), sin los calendarios que no se pudieron leer.
    const porDia = dias.map((dd, di) => {
        let a = 0, t = 0;
        bloques.filter(x => x.di === di && !x.sinLeer).forEach(x => { a += x.mAg + x.mMg + x.mEv; t += x.mDisp; });
        return { a, t };
    });
    const conEstado = (ests) => cs.filter(p => { const g = googleDe(p.id); return !!g && ests.includes(g.estado); });
    return {
        tz, dias, bloques, huecos, porDia, minH, maxH, hoyK: claveDia(ahora, tz), mAhora: minutoDelDia(ahora, tz),
        sinLeer: conEstado(['error']), sinGoogle: conEstado(['sin_google', 'sin_usuario']),
        kpi: {
            hDisp: mDisp / 60, hAg: mAg / 60, hMg: mMg / 60, hEv: mEv / 60, hLibre: (mDisp - mAg - mEv) / 60, nAg, hHueco,
            ocupacion: mBase ? (mAgBase + mEvBase) / mBase : 0,
            ocupAg: mBase ? mAgBase / mBase : 0, ocupEv: mBase ? mEvBase / mBase : 0,
        },
    };
}

// Qué pasa con los leads de una prioridad, en una línea.
export function textoEstrategia(d, g) {
    const ns = g.miembros.map(id => { const p = buscar(d, 'personas', id); return p ? p.nombre : ''; }).filter(Boolean);
    if (!ns.length) return 'Sumá closers.';
    if (ns.length === 1) return 'Todo va a ' + ns[0] + '.';
    if (g.estrategia === 'repartir') return 'Cada closer recibe su porcentaje de las agendas: el horario va a quien está más lejos de su parte.';
    if (g.estrategia === 'horario') return 'El lead ve los horarios de todos; cada uno va a ' + ns[0] + ' y, si está ocupado, a ' + ns[1] + (ns.length > 2 ? ' y así.' : '.');
    return 'Los leads van a ' + ns[0] + ' hasta llenar su agenda de los próximos ' + VENTANA_LLENAR_DIAS + ' días; después a ' + ns[1] + (ns.length > 2 ? ' y así.' : '.');
}

// Aviso de la prioridad cuando ningún miembro puede recibir leads.
export function avisoPrioridad(d, g) {
    const ms = g.miembros.map(id => buscar(d, 'personas', id)).filter(Boolean);
    if (!ms.length || miembrosValidos(d, g).length) return '';
    return 'Nadie tiene horario: los leads pasan a la siguiente estrategia con lugar y, si no hay, a todos los closers.';
}
