// Las acciones del menú de sesión que cada uno fija en el dock (la sección de la izquierda). Se guardan
// en este navegador, por cuenta: otra compu u otro navegador arranca con las de fábrica. Un mismo
// almacén para el menú y el dock: fijar algo en uno se ve al instante en el otro.
import { useCallback, useSyncExternalStore } from 'react';
import { avisarCambio, registrarParte } from './dockServidor';

const clave = (userId) => `dock-fijadas:${userId}`;

// Lo que no se fija: salir de la sesión y volver a la propia.
const NO_FIJABLES = new Set(['salir', 'volver']);
// Una que abre una lista (`panel`: Nuevo, Mis links) también: fijada, abre su lista desde el dock.
export const esFijable = (op) => !!op && !NO_FIJABLES.has(op.id) && (!!op.panel || typeof op.onClick === 'function');

// De fábrica: Nuevo y Learnito para los closers; Turnos (la ventana, ventanas/herramientas.js) para los setters.
const DE_FABRICA = { closer: ['nuevo', 'learnito'], setter: ['tool:turnos'] };
export const fijadasDeFabrica = (role) => DE_FABRICA[role] || [];

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

function escribir(userId, ids) {
    cache.set(userId, ids);
    try { window.localStorage.setItem(clave(userId), JSON.stringify(ids)); } catch { /* queda solo en memoria */ }
    oyentes.forEach((fn) => fn());
}

function guardar(userId, ids) {
    escribir(userId, ids);
    avisarCambio('fijadas', userId);
}

// En la cuenta (sesion/dockServidor.js): sin nada elegido todavía, null (valen las de fábrica).
registrarParte('fijadas', {
    leer: (userId) => {
        if (cache.has(userId)) return cache.get(userId);
        try { const v = JSON.parse(window.localStorage.getItem(clave(userId)) || 'null'); return Array.isArray(v) ? v : null; } catch { return null; }
    },
    escribir: (userId, ids) => { if (Array.isArray(ids)) escribir(userId, ids.filter((x) => typeof x === 'string')); },
});

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

// Lo que tiene pendientes queda fijado hasta resolverse (ADR-W242): estas herramientas, con `cuenta` > 0, van
// solas a la isla de fijadas, primero, y su pin no se puede sacar. En 0 vuelve a lo que eligió la persona.
export const CON_PENDIENTES = new Set(['inbox', 'avisos', 'conflictos', 'mis-reportes', 'playbook']);
export const tienePendientes = (op) => !!op && CON_PENDIENTES.has(op.id) && Number(op.cuenta) > 0;
