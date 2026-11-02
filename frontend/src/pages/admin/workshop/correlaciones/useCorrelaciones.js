import { useCallback, useRef, useState } from 'react';
import api from '../../../../services/api';
import { useDatosCacheados } from '../../../../services/cacheDeVistas';

/**
 * Pide las correlaciones al backend (recordadas por ventana, ver `cacheDeVistas`: ir y volver entre
 * pestañas no las vuelve a pedir). `datos` queda en null hasta la primera respuesta; al cambiar
 * el filtro se deja a la vista lo anterior (`recargando`) en vez de vaciar la pantalla.
 */
export default function useCorrelaciones(ultimos) {
    const [intento, setIntento] = useState(0);
    const { datos: actuales, error, cargando } = useDatosCacheados(`workshop:correlaciones:${ultimos || 'todos'}`,
        (signal) => api.get('workshop/correlaciones', { params: ultimos ? { ultimos } : {}, signal }).then((res) => res.data),
        { version: intento, onError: (err) => console.error('Error cargando correlaciones:', err) });
    // Mientras llega otra ventana que no se vio, queda a la vista la anterior.
    const anterior = useRef(null);
    if (actuales) anterior.current = actuales;

    const reintentar = useCallback(() => setIntento((n) => n + 1), []);
    return { datos: actuales ?? anterior.current, falla: Boolean(error), recargando: cargando, reintentar };
}
