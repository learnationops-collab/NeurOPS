// Las acciones del menú de sesión que cada uno fija en el dock (la sección de la izquierda). Se guardan
// en este navegador, por cuenta: otra compu u otro navegador arranca con las de fábrica. Un mismo
// almacén para el menú y el dock: fijar algo en uno se ve al instante en el otro.
import { useCallback, useSyncExternalStore } from 'react';

const clave = (userId) => `dock-fijadas:${userId}`;

// Lo que no se fija: salir de la sesión y las opciones que abren una lista dentro del menú.
const NO_FIJABLES = new Set(['salir', 'volver']);
export const esFijable = (op) => !!op && !NO_FIJABLES.has(op.id) && !op.panel && typeof op.onClick === 'function';

// De fábrica: Learnito para los closers.
export const fijadasDeFabrica = (role) => (role === 'closer' ? ['learnito'] : []);

const oyentes = new Set();
const cache = new Map();

function leer(userId, role) {
    if (cache.has(userId)) return cache.get(userId);
    let ids = null;
    try {
        const crudo = window.localStorage.getItem(clave(userId));
        const valor = crudo ? JSON.parse(crudo) : null;
        if (Array.isArray(valor)) ids = valor.filter((x) => typeof x === 'string');
    } catch { /* sin almacenamiento o dato roto: las de fábrica */ }
    const resultado = ids ?? fijadasDeFabrica(role);
    cache.set(userId, resultado);
    return resultado;
}

function guardar(userId, ids) {
    cache.set(userId, ids);
    try { window.localStorage.setItem(clave(userId), JSON.stringify(ids)); } catch { /* queda solo en memoria */ }
    oyentes.forEach((fn) => fn());
}

const suscribir = (fn) => {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
};

const SIN_USUARIO = [];

/** { fijadas: [ids en el orden en que se fijaron], alternar(id) }. Sin usuario no fija nada. */
export function useFijadas(user) {
    const userId = user?.id;
    const fijadas = useSyncExternalStore(suscribir, () => (userId ? leer(userId, user?.role) : SIN_USUARIO));
    const alternar = useCallback((id) => {
        if (!userId) return;
        const actuales = leer(userId, user?.role);
        guardar(userId, actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id]);
    }, [userId, user?.role]);
    return { fijadas, alternar };
}

// Solo para los tests: olvida lo leído para volver a mirar el almacenamiento.
export const _olvidarFijadas = () => cache.clear();
