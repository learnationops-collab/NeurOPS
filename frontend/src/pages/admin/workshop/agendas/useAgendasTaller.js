import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';

/**
 * Las agendas de uno o varios talleres (`GET /workshop/agendas?ids=`), las filas de Revisar › Agendas.
 * `datos` queda en null hasta que llegan: Revisar lo toma por «cargando» y dibuja su esqueleto.
 */
export const useAgendasTaller = (tallerIds) => {
    const [estado, setEstado] = useState({ datos: null, fallo: false });
    const [intento, setIntento] = useState(0);
    const ids = (tallerIds || []).join(',');

    useEffect(() => {
        if (!ids) return undefined;
        let cancelado = false;
        setEstado({ datos: null, fallo: false });
        api.get('workshop/agendas', { params: { ids } })
            .then(({ data }) => { if (!cancelado) setEstado({ datos: data, fallo: false }); })
            .catch((err) => {
                if (cancelado) return;
                console.error('Error cargando las agendas del taller:', err);
                setEstado({ datos: null, fallo: true });
            });
        return () => { cancelado = true; };
    }, [ids, intento]);

    const recargar = useCallback(() => setIntento((n) => n + 1), []);
    return { ...estado, recargar };
};

export default useAgendasTaller;
