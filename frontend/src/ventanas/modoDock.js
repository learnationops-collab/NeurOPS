// Dónde va la navegación (Configuración › Dock, como «Tu dock» de la Academia, ADR-111 de allá): el dock
// abajo (de fábrica) o una barra lateral a la izquierda, desplegada con los nombres o plegada a íconos.
// Se guarda en este navegador. En un teléfono siempre es el dock de abajo.
import { useSyncExternalStore } from 'react';

const CLAVE = 'dock-modo';
const DE_FABRICA = { lateral: false, desplegada: true };
const oyentes = new Set();
let actual = null;

function leer() {
    if (actual) return actual;
    actual = DE_FABRICA;
    try {
        const v = JSON.parse(window.localStorage.getItem(CLAVE) || 'null');
        if (v && typeof v === 'object') actual = { lateral: v.lateral === true, desplegada: v.desplegada !== false };
    } catch { /* sin almacenamiento: el de fábrica */ }
    return actual;
}

function guardar(cambios) {
    actual = { ...leer(), ...cambios };
    try { window.localStorage.setItem(CLAVE, JSON.stringify(actual)); } catch { /* queda en memoria */ }
    oyentes.forEach((fn) => fn());
}

const suscribir = (fn) => {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
};

/** { lateral, desplegada, setLateral(bool), setDesplegada(bool) } */
export function useModoDock() {
    const modo = useSyncExternalStore(suscribir, leer);
    return {
        ...modo,
        setLateral: (lateral) => guardar({ lateral }),
        setDesplegada: (desplegada) => guardar({ desplegada }),
    };
}
