// Avisa a la Academia que la persona está usando Work (ADR-W171), una vez por minuto mientras la pestaña está a la
// vista, para que el chat la muestre conectada en Work aunque no lo tenga abierto. La Academia la da por
// conectada 5 minutos. Va en HostVentanas, que se monta una sola vez.
import { useEffect } from 'react';
import api from '../../../services/api';

const CADA_MS = 60000;

export default function usePresencia(user) {
    useEffect(() => {
        if (!user) return undefined;
        const marcar = () => {
            if (!document.hidden) api.get('/chat/conectados', { skipBugReport: true }).catch(() => {});
        };
        marcar();
        const id = setInterval(marcar, CADA_MS);
        document.addEventListener('visibilitychange', marcar);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', marcar); };
    }, [user]);
}
