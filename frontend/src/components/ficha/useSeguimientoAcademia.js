import { useCallback, useEffect, useState } from 'react';
import { mensajeDeError, obtenerSeguimientoAcademia } from './fichaApi';

/**
 * Avance, seguimiento del equipo y uso del alumno en la Academia: `{datos, error, recargar}`, `datos` null mientras
 * carga. Un solo pedido para los tres bloques de Fulfillment: los tres salen del mismo expediente.
 */
export default function useSeguimientoAcademia(ficha) {
    const appointmentId = ficha?.identidad?.appointment_id ?? null;
    const clientId = ficha?.identidad?.client_id ?? null;
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [vuelta, setVuelta] = useState(0);

    useEffect(() => {
        if (appointmentId == null && clientId == null) return undefined;
        const ctrl = new AbortController();
        setError(null);
        obtenerSeguimientoAcademia({ appointmentId, clientId, signal: ctrl.signal })
            .then(setDatos)
            .catch((err) => { if (!ctrl.signal.aborted) setError(mensajeDeError(err)); });
        return () => ctrl.abort();
    }, [appointmentId, clientId, vuelta]);

    const recargar = useCallback(() => setVuelta((v) => v + 1), []);
    return { datos, error, recargar };
}
