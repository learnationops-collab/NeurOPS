import { useCallback, useState } from 'react';
import api from '../../../../services/api';
import { useDatosCacheados } from '../../../../services/cacheDeVistas';

/**
 * Las agendas de uno o varios talleres (`GET /workshop/agendas?ids=`), las filas de Revisar › Agendas.
 * `datos` queda en null hasta que llegan: Revisar lo toma por «cargando» y dibuja su esqueleto. Lo ya
 * pedido queda recordado (ver `cacheDeVistas`): volver a la pestaña no lo vuelve a pedir.
 */
export const useAgendasTaller = (tallerIds) => {
    const [intento, setIntento] = useState(0);
    const ids = (tallerIds || []).join(',');
    const { datos, error } = useDatosCacheados(ids ? `workshop:agendas:${ids}` : null,
        (signal) => api.get('workshop/agendas', { params: { ids }, signal }).then(({ data }) => data),
        { version: intento, onError: (err) => console.error('Error cargando las agendas del taller:', err) });

    const recargar = useCallback(() => setIntento((n) => n + 1), []);
    return { datos, fallo: Boolean(error) && !datos, recargar };
};

export default useAgendasTaller;
