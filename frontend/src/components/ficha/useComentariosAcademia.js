import { useEffect, useState } from 'react';
import { mensajeDeError, obtenerComentariosAcademia } from './fichaApi';

/**
 * Lo que anotó el equipo de la Academia (Dari, consultores, CES) sobre el alumno: `{datos, error}`, `datos`
 * null mientras carga. Lo usan Fulfillment y el hilo de Comunicación, que lo mezcla con las notas de Work.
 */
export default function useComentariosAcademia(ficha) {
    const appointmentId = ficha?.identidad?.appointment_id ?? null;
    const clientId = ficha?.identidad?.client_id ?? null;
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (appointmentId == null && clientId == null) return undefined;
        const ctrl = new AbortController();
        obtenerComentariosAcademia({ appointmentId, clientId, signal: ctrl.signal })
            .then(setDatos)
            .catch((err) => { if (!ctrl.signal.aborted) setError(mensajeDeError(err)); });
        return () => ctrl.abort();
    }, [appointmentId, clientId]);

    return { datos, error };
}

/** Un comentario de la Academia con la forma de una nota del hilo de Comunicación. */
export const comoNota = (c) => ({
    id: `academia-${c.id}`,
    autor: c.por || 'Academia',
    rol: 'Academia',
    fecha: c.fecha,
    texto: `${c.que || ''}${c.detalle && c.grupo === 'Seguimiento' ? ` — ${c.detalle}` : ''}`,
    notificados: [],
});
