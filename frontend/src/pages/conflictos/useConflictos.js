import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

/** La lista de casos (abiertos o cerrados) y el detalle del elegido, cada uno con su pedido. */
export default function useConflictos() {
    const [estado, setEstado] = useState('abierto');
    const [lista, setLista] = useState(null);
    const [elegido, setElegido] = useState(null);
    // El detalle guardado con su id: al cambiar de caso, el viejo deja de valer sin limpiarlo a mano.
    const [guardado, setGuardado] = useState(null);
    const detalle = guardado && guardado.id === elegido ? guardado.data : null;
    const setDetalle = useCallback((data) => setGuardado({ id: data?.id ?? null, data }), []);
    const [error, setError] = useState(null);

    const cargar = useCallback(async () => {
        try {
            const { data } = await api.get('/conflictos', { params: { estado } });
            setLista(data);
            setError(null);
        } catch (e) {
            setError(e.response?.data?.message || 'No se pudieron cargar los casos.');
        }
    }, [estado]);

    useEffect(() => { cargar(); }, [cargar]);

    useEffect(() => {
        if (!elegido) return undefined;
        let vivo = true;
        api.get(`/conflictos/${elegido}`).then(({ data }) => { if (vivo) setDetalle(data); })
            .catch(() => { if (vivo) setGuardado({ id: elegido, data: { error: true } }); });
        return () => { vivo = false; };
    }, [elegido, setDetalle]);

    const escribir = useCallback(async (ruta, datos) => {
        const { data } = await api.post(`/conflictos/${elegido}/${ruta}`, datos);
        setDetalle(data);
        await cargar();
        return data;
    }, [elegido, cargar, setDetalle]);

    return {
        estado, setEstado: (e) => { setEstado(e); setElegido(null); },
        lista, error, elegido, setElegido, detalle,
        cerrar: (datos) => escribir('cerrar', datos),
        reabrir: () => escribir('reabrir', {}),
    };
}
