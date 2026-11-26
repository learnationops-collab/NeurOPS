// Un solo reloj por segundo para toda la pantalla: los contadores de espera (`Cronometro`) se suscriben acá en vez de
// tener cada uno su intervalo. Sin nadie mirando, se apaga.
import { useSyncExternalStore } from 'react';

const oyentes = new Set();
let ahora = Date.now();
let intervalo = null;

function suscribir(fn) {
    oyentes.add(fn);
    if (!intervalo) {
        intervalo = setInterval(() => { ahora = Date.now(); oyentes.forEach((f) => f()); }, 1000);
    }
    return () => {
        oyentes.delete(fn);
        if (!oyentes.size) { clearInterval(intervalo); intervalo = null; }
    };
}

export const useSegundo = () => useSyncExternalStore(suscribir, () => ahora);

// «4:07», «3:04:07» o, desde un día, «2 d 3 h».
export function reloj(seg) {
    const s = Math.max(0, Math.floor(seg));
    if (s >= 86400) return `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h`;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const dos = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${dos(m)}:${dos(s % 60)}` : `${m}:${dos(s % 60)}`;
}

// Los cortes que pidió Mario (26/11): menos de 5 min es responder rápido; más de 30, tarde.
export const RAPIDA = 5 * 60;
export const TARDE = 30 * 60;
