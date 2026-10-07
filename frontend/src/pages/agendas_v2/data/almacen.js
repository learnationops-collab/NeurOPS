// Estado de los datos de Thalamus: colecciones, perfil, integraciones y reservas.
// Las ediciones se ven al instante y se guardan en una pausa de 600 ms. Ctrl+Z deshace con un
// historial de 80 cambios. El estado es inmutable para que React detecte los cambios.

import { conFormAlDia } from '../core/eventos';
import { COLECCIONES, NORM, normalInteg, normalPerfil } from '../core/normalizar';
import { clonar, uid } from '../core/util';
import { crearAdaptadorApi } from './adaptadorApi';
import { crearAdaptadorLocal } from './adaptadorLocal';
import { MODO_LOCAL } from './modo';
import { toast } from '../ui/toast';

const PAUSA = 600;
const MAX_HIST = 80;

function msgError(e) {
    const c = e && e.code;
    if (c === 'invalid_argument') return 'No tenés permiso para editar esto.';
    if (c === 'quota_exceeded') return 'Se llenó el espacio de guardado.';
    if (c === 'revoked' || c === 'not_granted') return 'Se perdió el acceso. Recargá la página.';
    return 'No se pudo guardar. Revisá la conexión.';
}

export function crearAlmacen(adaptador, { avisar = () => {} } = {}) {
    let estado = {
        cargando: true,
        cargado: false, // true cuando la carga inicial salió bien (no solo terminó)
        d: Object.fromEntries(COLECCIONES.map(c => [c, []])),
        perfil: normalPerfil(null),
        integ: normalInteg(null),
        reservas: [],
    };
    const subs = new Set();
    const pend = {};
    let pendT = null;
    const hist = [];
    let deshaciendo = false;

    const emitir = () => subs.forEach(fn => fn());
    const set = (parcial) => { estado = { ...estado, ...parcial }; emitir(); };
    const setCol = (col, arr) => set({ d: { ...estado.d, [col]: arr } });
    const buscar = (col, id) => estado.d[col].find(x => x.id === id);
    const fallo = (e) => avisar(msgError(e), 'error');

    function aplicarCargados({ cols, perfil, integ, reservas }) {
        const d = {};
        COLECCIONES.forEach(c => { d[c] = (cols[c] || []).map(x => NORM[c](x.id, x)); });
        // Lo que todavía no se guardó gana sobre lo que llega.
        Object.keys(pend).forEach(k => {
            const [col, id] = k.split('/');
            d[col] = d[col].map(x => (x.id === id ? NORM[col](id, { ...x, ...clonar(pend[k]) }) : x));
        });
        set({ cargando: false, cargado: true, d, perfil: normalPerfil(perfil), integ: normalInteg(integ), reservas: Array.isArray(reservas) ? reservas : [] });
    }

    function recordar(col, id) {
        if (deshaciendo) return;
        const k = col + '/' + id, ahora = Date.now(), ult = hist[hist.length - 1];
        if (ult && ult.k === k && ahora - ult.t < 1500) { ult.t = ahora; return; }
        const x = buscar(col, id);
        hist.push({ k, col, id, prev: x ? clonar(x) : null, t: ahora });
        if (hist.length > MAX_HIST) hist.shift();
    }

    // campos: solo lo que cambió (el adaptador de la API lo manda como PATCH). Sin campos va el documento entero.
    function persistir(col, id, campos) {
        const x = buscar(col, id);
        if (!x) return Promise.resolve();
        const data = clonar(x); delete data.id;
        return adaptador.guardar(col, id, data, campos).catch(fallo);
    }

    // Un formulario editado se ve ya en los eventos publicados que lo usan. El servidor lo hace al
    // guardarlo; acá solo se copia para no esperar a recargar (y se guarda si los datos viven en el navegador).
    function republicarForm(formId) {
        const form = buscar('formularios', formId);
        if (!form) return;
        const cambiados = [];
        const eventos = estado.d.eventos.map(e => {
            if (e.formulario !== formId) return e;
            const publicado = conFormAlDia(e, form);
            if (!publicado) return e;
            cambiados.push(e.id);
            return { ...e, publicado };
        });
        if (!cambiados.length) return;
        setCol('eventos', eventos);
        if (adaptador.tipo === 'local') cambiados.forEach(id => persistir('eventos', id));
    }

    function flush() {
        clearTimeout(pendT);
        const ks = Object.keys(pend);
        ks.forEach(k => { const campos = pend[k]; delete pend[k]; const [col, id] = k.split('/'); persistir(col, id, campos); });
    }

    const api = {
        subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
        getState() { return estado; },
        adaptador,

        async iniciar() {
            try { aplicarCargados(await adaptador.cargar()); } catch (e) { set({ cargando: false }); fallo(e); }
            return adaptador.alCambiar(async () => { try { aplicarCargados(await adaptador.cargar()); } catch { /* sigue con lo que tiene */ } });
        },

        buscar,

        // Vuelve a traer todo (después de una importación que creó varios documentos en el servidor).
        async recargar() { aplicarCargados(await adaptador.cargar()); },

        crear(col, data) {
            const id = uid('d');
            if (!deshaciendo) { hist.push({ k: col + '/' + id, col, id, prev: null, t: 0 }); if (hist.length > MAX_HIST) hist.shift(); }
            setCol(col, [...estado.d[col], NORM[col](id, clonar(data))]);
            persistir(col, id);
            return id;
        },

        // Cambia campos de un documento. Se ve ya; se guarda en una pausa (o ya, con inmediato).
        editar(col, id, campos, inmediato = false) {
            const x = buscar(col, id);
            if (!x) return;
            recordar(col, id);
            setCol(col, estado.d[col].map(y => (y.id === id ? NORM[col](id, { ...y, ...clonar(campos) }) : y)));
            if (col === 'formularios') republicarForm(id);
            const k = col + '/' + id;
            pend[k] = { ...(pend[k] || {}), ...clonar(campos) };
            clearTimeout(pendT);
            if (inmediato) flush(); else pendT = setTimeout(flush, PAUSA);
        },

        // Reemplaza un documento entero (lo usa deshacer).
        fijar(col, id, data) {
            const d = clonar(data); delete d.id;
            const n = NORM[col](id, d), arr = estado.d[col];
            setCol(col, arr.some(x => x.id === id) ? arr.map(x => (x.id === id ? n : x)) : [...arr, n]);
            delete pend[col + '/' + id];
            persistir(col, id);
            if (col === 'formularios') republicarForm(id);
        },

        borrar(col, id) {
            const x0 = buscar(col, id);
            if (!x0) return;
            if (!deshaciendo) { hist.push({ k: col + '/' + id + '/del', col, id, prev: clonar(x0), t: 0 }); if (hist.length > MAX_HIST) hist.shift(); }
            setCol(col, estado.d[col].filter(x => x.id !== id));
            delete pend[col + '/' + id];
            adaptador.borrar(col, id).catch(fallo);
        },

        flush,

        // Deshace el último cambio. Devuelve false si no había nada.
        deshacer() {
            const h = hist.pop();
            if (!h) return false;
            deshaciendo = true;
            try {
                if (!h.prev) { if (buscar(h.col, h.id)) api.borrar(h.col, h.id); }
                else api.fijar(h.col, h.id, h.prev);
            } finally { deshaciendo = false; }
            return true;
        },

        guardarPerfil(cambios) {
            const perfil = normalPerfil({ ...estado.perfil, ...cambios });
            set({ perfil });
            return adaptador.guardarPerfil(perfil).catch(fallo);
        },
        guardarInteg(integ) {
            const n = normalInteg(integ);
            set({ integ: n });
            return adaptador.guardarInteg(n).catch(fallo);
        },

        // Reservas: crear revalida en el adaptador (el servidor, más adelante) que el horario siga libre.
        async crearReserva(payload) {
            const r = await adaptador.crearReserva(payload);
            set({ reservas: [...estado.reservas, r] });
            return r;
        },
        async cancelarReserva(id) {
            await adaptador.cancelarReserva(id);
            set({ reservas: estado.reservas.map(r => (r.id === id ? { ...r, estado: 'cancelada' } : r)) });
        },
    };
    return api;
}

// Viven en ocupacion.js (la página pública las usa sin el almacén); se reexportan para no cambiar los imports.
export { opcionesDeOcupacion, reservasDe } from './ocupacion';

// Instancia única de la app: contra la API por defecto; en este navegador en los tests o con VITE_AGENDAS_LOCAL=1.
let unico = null;
export function almacenThalamus() {
    if (!unico) unico = crearAlmacen(MODO_LOCAL ? crearAdaptadorLocal() : crearAdaptadorApi(), { avisar: toast });
    return unico;
}
