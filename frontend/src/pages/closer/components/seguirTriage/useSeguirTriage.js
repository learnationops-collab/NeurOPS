// Datos de «Seguir» de triage (ADR-W241): la bandeja y las acciones de cada fila, con «Deshacer».
import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';
import { toast } from '../../../../components/standard';

const mensaje = (e, porDefecto) => e?.response?.data?.message || porDefecto;

export default function useSeguirTriage(refreshKey) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);

    const cargar = useCallback(() => api.get('/closer/followups/triage')
        .then((r) => { setDatos(r.data); setError(null); })
        .catch((e) => setError(mensaje(e, 'No se pudo traer los seguimientos'))), []);

    useEffect(() => { cargar(); }, [cargar, refreshKey]);

    const deshacer = useCallback((id, antes) => api.post(`/closer/followups/triage/${id}`, { accion: 'deshacer', antes })
        .then(() => { toast('Deshecho'); cargar(); })
        .catch((e) => toast(mensaje(e, 'No se pudo deshacer'), 'error')), [cargar]);

    // Una acción de la fila. Devuelve true si se guardó; el aviso trae «Deshacer» con lo que había antes.
    const accion = useCallback(async (fila, cuerpo, aviso) => {
        try {
            const r = await api.post(`/closer/followups/triage/${fila.id}`, cuerpo);
            const antes = r.data?.antes;
            toast(`${fila.lead_name}: ${aviso || r.data?.texto}`, 'success',
                antes ? { label: 'Deshacer', onClick: () => deshacer(fila.id, antes) } : null);
            cargar();
            return true;
        } catch (e) {
            toast(mensaje(e, 'No se pudo guardar'), 'error');
            return false;
        }
    }, [cargar, deshacer]);

    return { datos, error, cargar, accion };
}
