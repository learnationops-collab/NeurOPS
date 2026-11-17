// Las ventanas abiertas (herramientas que flotan sobre cualquier pantalla), como el `dockModals` de la
// Academia y Leadership. Un solo almacén para el host que las dibuja y el dock que lista las minimizadas.
// Sobreviven a la navegación (el host va en App.jsx) y, en esta pestaña, a recargar (sessionStorage).
import { useSyncExternalStore } from 'react';

const CLAVE = 'ventanas-abiertas';
const oyentes = new Set();

const leer = () => {
    try {
        const v = JSON.parse(sessionStorage.getItem(CLAVE) || '[]');
        return Array.isArray(v) ? v.filter(x => x && typeof x.key === 'string') : [];
    } catch {
        return [];
    }
};

let items = leer();          // [{key, estado: 'abierta' | 'minimizada', max, pos: {x, y} | null, z}]
let arriba = items.reduce((m, x) => Math.max(m, x.z || 0), 0);

const emitir = (nuevos) => {
    items = nuevos;
    try { sessionStorage.setItem(CLAVE, JSON.stringify(items)); } catch { /* sin storage, solo en memoria */ }
    oyentes.forEach(f => f());
};
const cambiar = (key, cambios) => emitir(items.map(x => (x.key === key ? { ...x, ...cambios } : x)));

export function abrirVentana(key) {
    arriba += 1;
    if (items.some(x => x.key === key)) cambiar(key, { estado: 'abierta', z: arriba });
    else emitir([...items, { key, estado: 'abierta', max: false, pos: null, z: arriba }]);
}
export const enfocarVentana = (key) => { arriba += 1; cambiar(key, { z: arriba }); };
export const minimizarVentana = (key) => cambiar(key, { estado: 'minimizada', max: false });
export const maximizarVentana = (key, max) => cambiar(key, { max, estado: 'abierta' });
export const moverVentana = (key, pos) => cambiar(key, { pos, max: false });
export const cerrarVentana = (key) => emitir(items.filter(x => x.key !== key));

const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
export const useVentanas = () => useSyncExternalStore(suscribir, () => items);
