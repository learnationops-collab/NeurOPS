// Historial del reporte: GET /api/reporte/historial?periodo=7|mes|30. Al cambiar de período queda el
// dato viejo a la vista hasta que llega el nuevo.
import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function useHistorial({ userId, periodo, version = 0 }) {
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let vivo = true;
        setCargando(true);
        api.get('/reporte/historial', { params: { periodo, ...(userId ? { user_id: userId } : {}) } })
            .then((res) => { if (vivo) { setDatos(res.data); setError(null); } })
            .catch((e) => { if (vivo) { console.error(`Error al cargar el historial: ${e}`); setError(e.response?.data?.error || 'No se pudo cargar el historial.'); } })
            .finally(() => { if (vivo) setCargando(false); });
        return () => { vivo = false; };
    }, [periodo, userId, version]);
    return { datos, cargando, error };
}
