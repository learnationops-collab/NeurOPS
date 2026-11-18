// Que el setter se entere cuando le escribe un lead, aunque esté en otra pestaña: el número de conversaciones sin
// leer en el título («(3) Inbox») y, si dio permiso, un aviso del escritorio por cada mensaje nuevo de un lead suyo
// (o de cualquiera, para quien no es setter). Tocar el aviso abre esa conversación.
import { useCallback, useEffect, useRef, useState } from 'react';
import { quien } from './colas';

const soportado = () => typeof window !== 'undefined' && 'Notification' in window;

export default function useAvisos(lista, { yo, soloMias, elegida, onAbrir }) {
    const vistos = useRef(null);
    const [permiso, setPermiso] = useState(() => (soportado() ? Notification.permission : 'denied'));
    const mias = lista.filter((c) => !soloMias || c.asignado?.id === yo);
    const sinLeer = mias.filter((c) => c.sin_leer > 0).length;

    useEffect(() => {
        const base = document.title.replace(/^\(\d+\)\s*/, '');
        document.title = sinLeer ? `(${sinLeer}) ${base}` : base;
        return () => { document.title = document.title.replace(/^\(\d+\)\s*/, ''); };
    }, [sinLeer]);

    useEffect(() => {
        const ahora = new Map(mias.map((c) => [c.id, c.sin_leer || 0]));
        const antes = vistos.current;
        vistos.current = ahora;
        // La primera carga no avisa: solo lo que llega mientras la bandeja está abierta.
        if (!antes || permiso !== 'granted') return;
        mias.forEach((c) => {
            const nuevos = (c.sin_leer || 0) > (antes.get(c.id) || 0);
            if (!nuevos || (c.id === elegida && !document.hidden)) return;
            try {
                const aviso = new Notification(`${quien(c)} te escribió`, { body: c.ultimo_texto || '', tag: `inbox-${c.id}` });
                aviso.onclick = () => { window.focus(); onAbrir(c.id); aviso.close(); };
            } catch (e) {
                console.error(`[INBOX] Aviso del escritorio: ${e}`);
            }
        });
    }, [mias, permiso, elegida, onAbrir]);

    const pedirPermiso = useCallback(async () => {
        if (!soportado()) return;
        setPermiso(await Notification.requestPermission());
    }, []);

    return { permiso, pedirPermiso, soportado: soportado() };
}
