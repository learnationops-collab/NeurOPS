import { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// Quién contesta conversaciones en el Inbox: su opción va en Herramientas con lo que espera respuesta.
const ROLES = ['setter', 'triage'];
const CADA = 60000;

/**
 * «Inbox» en el menú de sesión (ADR-W242): las conversaciones asignadas que esperan respuesta. Con alguna,
 * queda fijado en el dock hasta resolverse (`tienePendientes`, sesion/fijadas.js).
 */
export default function useOpcionesDeInbox() {
    const { user } = useAuth() || {};
    const puede = ROLES.includes(user?.role);
    const [esperan, setEsperan] = useState(0);
    useEffect(() => {
        if (!puede) return undefined;
        let vivo = true;
        const pedir = () => api.get('/inbox/mis-pendientes')
            .then(({ data }) => { if (vivo) setEsperan(data?.esperan || 0); }).catch(() => {});
        pedir();
        const id = setInterval(pedir, CADA);
        return () => { vivo = false; clearInterval(id); };
    }, [puede]);
    if (!puede) return { opciones: [] };
    return {
        opciones: [{
            id: 'inbox',
            label: 'Inbox',
            Icono: Inbox,
            cuenta: esperan || null,
            titulo: esperan ? `${esperan} ${esperan === 1 ? 'conversación espera' : 'conversaciones esperan'} tu respuesta` : 'Tus conversaciones',
            onClick: () => { if (!window.location.pathname.startsWith('/inbox')) window.location.assign('/inbox'); },
        }],
    };
}
