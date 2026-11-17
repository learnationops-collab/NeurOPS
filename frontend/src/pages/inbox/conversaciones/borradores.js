// El borrador de cada conversación: lo que el setter dejó escrito y no mandó. Sobrevive a cambiar de chat y a
// recargar (en este navegador), y la lista lo muestra en la fila. Al mandar o borrar el texto, se va.
import { useEffect, useState } from 'react';

const CLAVE = 'inbox:borradores';
const oyentes = new Set();

function leer() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE)) || {};
    } catch {
        return {};
    }
}

let mapa = leer();

export const borradorDe = (id) => mapa[id] || '';

export function guardarBorrador(id, texto) {
    const t = texto && texto.trim() && !texto.startsWith('/') ? texto : '';
    if ((mapa[id] || '') === t) return;
    mapa = { ...mapa };
    if (t) mapa[id] = t;
    else delete mapa[id];
    try {
        localStorage.setItem(CLAVE, JSON.stringify(mapa));
    } catch {
        // Sin almacenamiento (ventana privada): el borrador queda solo mientras la pestaña siga abierta.
    }
    oyentes.forEach((f) => f());
}

// Todos los borradores; se vuelve a pintar cuando cambia alguno.
export function useBorradores() {
    const [, setVuelta] = useState(0);
    useEffect(() => {
        const f = () => setVuelta((v) => v + 1);
        oyentes.add(f);
        return () => oyentes.delete(f);
    }, []);
    return mapa;
}
