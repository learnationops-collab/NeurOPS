// Avisa a la Academia que la persona está usando Work (ADR-W171), una vez por minuto mientras la pestaña está a la
// vista, para que el chat la muestre conectada en Work aunque no lo tenga abierto. La Academia la da por
// conectada 5 minutos. Va en HostVentanas, que se monta una sola vez. De paso trae la bandeja: lo no leído de
// Equipo y de las conversaciones directas, que muestra el botón Mensajes del dock (useSinLeerChat, ADR-W175).
import { useEffect, useSyncExternalStore } from 'react';
import api from '../../../services/api';

const CADA_MS = 60000;
const SILENCIOSO = { skipBugReport: true };

let sinLeer = 0;
const oyentes = new Set();

/** Lo no leído del chat; la ventana Chat lo actualiza también cuando trae su bandeja. */
export function publicarSinLeer(n) {
    if (n === sinLeer) return;
    sinLeer = n;
    oyentes.forEach(f => f());
}

export const totalSinLeer = (bandeja) => (bandeja?.equipo || 0) + (bandeja?.directos || []).reduce((s, d) => s + (d.sin_leer || 0), 0);

export function useSinLeerChat() {
    return useSyncExternalStore((f) => { oyentes.add(f); return () => oyentes.delete(f); }, () => sinLeer);
}

export default function usePresencia(user) {
    useEffect(() => {
        if (!user) return undefined;
        const marcar = () => {
            if (document.hidden) return;
            api.get('/chat/conectados', SILENCIOSO).catch(() => {});
            api.get('/chat/bandeja', SILENCIOSO).then(({ data }) => {
                const equipo = (data.canales || []).find(c => c.slug === 'equipo');
                publicarSinLeer(totalSinLeer({ equipo: equipo?.sin_leer, directos: data.directos }));
            }).catch(() => {});
        };
        marcar();
        const id = setInterval(marcar, CADA_MS);
        document.addEventListener('visibilitychange', marcar);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', marcar); };
    }, [user]);
}
