// Adaptador de guardado en este navegador (localStorage). Junto con adaptadorApi.js (el backend) son los
// únicos lugares que saben DÓNDE se guarda; almacenThalamus() elige uno (ver data/modo.js).
//
// Contrato de un adaptador:
//   cargar()                      → Promise<{cols, perfil, integ, reservas}>
//   guardar(col, id, data, campos?) → Promise (data sin id; campos: solo lo que cambió, si se sabe)
//   borrar(col, id)               → Promise
//   guardarPerfil(perfil)         → Promise
//   guardarInteg(integ)           → Promise
//   crearReserva(payload)         → Promise<reserva>  | rechaza {code:'ocupado'} si el horario ya no está libre
//   cancelarReserva(id)           → Promise
//   alCambiar(cb)                 → () => void   (cambios hechos desde otra pestaña u otra persona)
//   usuarios()                    → Promise<[{id, nombre, email, rol, tz}]>  closers y setters reales (local: ninguno)

import { COLECCIONES } from '../core/normalizar';
import { uid } from '../core/util';

const PRE = 'thalamus-';
const clave = (k) => PRE + k;

function leer(k, def) {
    try { const v = JSON.parse(localStorage.getItem(clave(k)) || 'null'); return v == null ? def : v; } catch { return def; }
}
function escribir(k, v) {
    try { localStorage.setItem(clave(k), JSON.stringify(v)); }
    catch (e) { const err = new Error('No se pudo guardar'); err.code = e && e.name === 'QuotaExceededError' ? 'quota_exceeded' : 'unavailable'; throw err; }
}

export function crearAdaptadorLocal() {
    const leerCol = (col) => { const a = leer(col, []); return Array.isArray(a) ? a : []; };
    return {
        tipo: 'local',
        async cargar() {
            const cols = {};
            COLECCIONES.forEach(c => { cols[c] = leerCol(c); });
            return { cols, perfil: leer('perfil', null), integ: leer('integ', null), reservas: leer('reservas', []) };
        },
        async guardar(col, id, data) {
            const a = leerCol(col), i = a.findIndex(x => x.id === id), doc = { ...data, id };
            if (i >= 0) a[i] = doc; else a.push(doc);
            escribir(col, a);
        },
        async borrar(col, id) { escribir(col, leerCol(col).filter(x => x.id !== id)); },
        async guardarPerfil(p) { escribir('perfil', p); },
        async guardarInteg(i) { escribir('integ', i); },
        async usuarios() { return []; },
        async crearReserva(payload) {
            const rs = leer('reservas', []);
            const inicio = payload.inicio ? Date.parse(payload.inicio) : null;
            const fin = inicio != null ? inicio + payload.duracion_min * 60000 : null;
            // Misma regla que tiene que hacer cumplir el servidor dentro de una transacción.
            if (inicio != null && payload.closer_id && rs.some(r => r.estado !== 'cancelada' && r.closer_id === payload.closer_id && r.inicio_ms < fin && inicio < r.fin_ms)) {
                const e = new Error('Ese horario se acaba de ocupar.'); e.code = 'ocupado'; throw e;
            }
            const r = { ...payload, id: uid('rs'), estado: payload.descalificada ? 'descalificada' : 'agendada', inicio_ms: inicio, fin_ms: fin, creada: new Date().toISOString() };
            rs.push(r);
            escribir('reservas', rs);
            return r;
        },
        async cancelarReserva(id) {
            escribir('reservas', leer('reservas', []).map(r => (r.id === id ? { ...r, estado: 'cancelada' } : r)));
        },
        alCambiar(cb) {
            const fn = (e) => { if (e.key && e.key.startsWith(PRE)) cb(); };
            window.addEventListener('storage', fn);
            return () => window.removeEventListener('storage', fn);
        },
    };
}
