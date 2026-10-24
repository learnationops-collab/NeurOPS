import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';

/**
 * Pide las correlaciones al backend. `datos` queda en null hasta la primera respuesta; al cambiar
 * el filtro se deja a la vista lo anterior (`recargando`) en vez de vaciar la pantalla.
 */
export default function useCorrelaciones(ultimos) {
    const [datos, setDatos] = useState(null);
    const [falla, setFalla] = useState(false);
    const [recargando, setRecargando] = useState(false);
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        let vigente = true;
        setRecargando(true);
        api.get('workshop/correlaciones', { params: ultimos ? { ultimos } : {} })
            .then((res) => { if (vigente) { setDatos(res.data); setFalla(false); } })
            .catch((err) => {
                console.error('Error cargando correlaciones:', err);
                if (vigente) setFalla(true);
            })
            .finally(() => { if (vigente) setRecargando(false); });
        return () => { vigente = false; };
    }, [ultimos, intento]);

    const reintentar = useCallback(() => setIntento((n) => n + 1), []);
    return { datos, falla, recargando, reintentar };
}
