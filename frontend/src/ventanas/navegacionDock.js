// La navegación editable del dock (Dock 2.0, como `$store.dockIslas` de Leadership): cada uno ordena,
// oculta y renombra las secciones de cada dock. Una oculta sale de la isla del medio y queda en
// Herramientas (y se puede fijar a la izquierda). Se guarda en este navegador, por cuenta y por dock.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { avisarCambio, registrarParte } from '../sesion/dockServidor';

const VACIO = { orden: [], ocultos: [], nombres: {} };
const clave = (userId, dock) => `dock-nav:${userId}:${dock}`;
const cache = new Map();
const oyentes = new Set();
let editando = null;

const avisar = () => oyentes.forEach((fn) => fn());
const suscribir = (fn) => {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
};

function leer(k) {
    if (cache.has(k)) return cache.get(k);
    let v = VACIO;
    try {
        const crudo = window.localStorage.getItem(k);
        const p = crudo ? JSON.parse(crudo) : null;
        if (p && typeof p === 'object') {
            v = {
                orden: Array.isArray(p.orden) ? p.orden : [],
                ocultos: Array.isArray(p.ocultos) ? p.ocultos : [],
                nombres: p.nombres && typeof p.nombres === 'object' ? p.nombres : {},
            };
        }
    } catch { /* sin almacenamiento o dato roto: la de fábrica */ }
    cache.set(k, v);
    return v;
}

function escribir(k, v) {
    cache.set(k, v);
    try {
        if (v === VACIO) window.localStorage.removeItem(k);
        else window.localStorage.setItem(k, JSON.stringify(v));
    } catch { /* queda solo en memoria */ }
    avisar();
}

function guardar(k, v) {
    escribir(k, v);
    avisarCambio('nav', Number(k.split(':')[1]));
}

// En la cuenta (sesion/dockServidor.js): { dock: { orden, ocultos, nombres } } de todas las pantallas.
registrarParte('nav', {
    leer: (userId) => {
        const prefijo = `dock-nav:${userId}:`;
        const todo = {};
        try {
            for (let i = 0; i < window.localStorage.length; i += 1) {
                const k = window.localStorage.key(i);
                if (k && k.startsWith(prefijo)) todo[k.slice(prefijo.length)] = leer(k);
            }
        } catch { /* sin almacenamiento */ }
        cache.forEach((v, k) => { if (k.startsWith(prefijo)) todo[k.slice(prefijo.length)] = v; });
        Object.keys(todo).forEach((d) => { if (todo[d] === VACIO) delete todo[d]; });
        return todo;
    },
    escribir: (userId, todo) => {
        if (!todo || typeof todo !== 'object') return;
        Object.entries(todo).forEach(([dock, v]) => {
            if (v && typeof v === 'object') {
                const k = clave(userId, dock);
                cache.delete(k);
                try { window.localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
            }
        });
        avisar();
    },
});

/**
 * { todas (en su orden, con su nombre y `oculta`), visibles, ocultas, editando, editar(on), ordenar(ids),
 * alternarOculta(id), renombrar(id, nombre), restablecer() }. Siempre queda al menos una a la vista.
 */
export function useNavegacionDock(user, dock, secciones) {
    const k = user?.id && dock ? clave(user.id, dock) : null;
    const cfg = useSyncExternalStore(suscribir, () => (k ? leer(k) : VACIO));
    const enEdicion = useSyncExternalStore(suscribir, () => k !== null && editando === k);

    const todas = useMemo(() => {
        const porId = new Map(secciones.map((s) => [s.id, s]));
        const ids = [...cfg.orden.filter((id) => porId.has(id)),
            ...secciones.map((s) => s.id).filter((id) => !cfg.orden.includes(id))];
        return ids.map((id) => {
            const s = porId.get(id);
            return { ...s, label: cfg.nombres[id] || s.label, labelOriginal: s.label, oculta: cfg.ocultos.includes(id) };
        });
    }, [cfg, secciones]);

    const cambiar = useCallback((fn) => { if (k) guardar(k, fn(leer(k))); }, [k]);
    const visibles = todas.filter((s) => !s.oculta);

    return {
        todas,
        visibles,
        ocultas: todas.filter((s) => s.oculta),
        editando: enEdicion,
        editar: (on) => { editando = on ? k : null; avisar(); },
        ordenar: (ids) => cambiar((c) => ({ ...c, orden: ids })),
        alternarOculta: (id) => cambiar((c) => {
            if (c.ocultos.includes(id)) return { ...c, ocultos: c.ocultos.filter((x) => x !== id) };
            return visibles.length <= 1 ? c : { ...c, ocultos: [...c.ocultos, id] };
        }),
        renombrar: (id, nombre) => cambiar((c) => {
            const original = secciones.find((s) => s.id === id)?.label;
            const t = (nombre || '').trim().slice(0, 24);
            const nombres = { ...c.nombres };
            if (!t || t === original) delete nombres[id];
            else nombres[id] = t;
            return { ...c, nombres };
        }),
        restablecer: () => { if (k) guardar(k, VACIO); },
    };
}
