// Datos de Turnos › «Lo que ve el lead» (GET /agendas-v2/turnos-lead) y el cambio de días del link
// (PUT /agendas-v2/eventos/:id/dias), que va directo al link en vivo (ADR-W226).

import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';
import { toast } from '../../../../components/standard';

const CADA = 60000;

export function useLoQueVe(tz) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState('');

    const cargar = useCallback(async () => {
        try {
            const { data } = await api.get('/agendas-v2/turnos-lead', { params: tz ? { tz } : undefined, skipBugReport: true });
            setDatos(data);
            setError('');
        } catch (e) {
            console.error(`turnos-lead: ${e}`);
            setError('No se pudieron leer los horarios.');
        }
    }, [tz]);

    useEffect(() => {
        cargar();
        const h = setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, CADA);
        return () => clearInterval(h);
    }, [cargar]);

    const cambiarDias = useCallback(async (link, n, tipo) => {
        const antes = datos;
        // Se ve al instante; los horarios se recalculan con la respuesta.
        setDatos(d => d && { ...d, links: d.links.map(l => (l.id === link.id ? { ...l, reservas: { ...l.reservas, n, tipo } } : l)) });
        setGuardando(link.id);
        try {
            await api.put(`/agendas-v2/eventos/${link.id}/dias`, { n, tipo });
            await cargar();
            toast(`${link.nombre}: ahora se puede agendar ${n} ${tipo === 'habiles' ? 'días hábiles' : 'días'}`, 'success');
        } catch (e) {
            console.error(`turnos-lead dias: ${e}`);
            setDatos(antes);
            toast('No se pudo cambiar los días del link.', 'error');
        } finally {
            setGuardando('');
        }
    }, [datos, cargar]);

    return { datos, error, guardando, cambiarDias };
}
