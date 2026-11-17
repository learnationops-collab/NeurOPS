import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';

/**
 * El tipo y los grupos de WhatsApp de un taller (`GET/PUT workshop/events/<id>/grupos`).
 * `datos` en null: todavía no llegó. `guardar` devuelve el error como texto, o null si salió bien.
 */
export const useGruposTaller = (eventId) => {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let vivo = true;
        api.get(`workshop/events/${eventId}/grupos`)
            .then((res) => { if (vivo) setDatos(res.data); })
            .catch((err) => { if (vivo) setError(err.response?.data?.error || 'No se pudieron cargar los grupos'); });
        return () => { vivo = false; };
    }, [eventId]);

    const guardar = useCallback(async (cuerpo) => {
        try {
            const res = await api.put(`workshop/events/${eventId}/grupos`, cuerpo);
            setDatos(res.data);
            return null;
        } catch (err) {
            return err.response?.data?.error || 'No se pudieron guardar los grupos';
        }
    }, [eventId]);

    return { datos, error, guardar };
};
