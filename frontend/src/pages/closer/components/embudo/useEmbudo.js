import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { guardarCache, leerCache } from '../../../../services/cacheDeVistas';

const CLAVE = 'closer:embudo:v2';

const errorDe = (err, porDefecto) => err?.response?.data?.error || porDefecto;

// Datos y acciones del embudo de seguimiento. `refreshKey` sube cuando otra acción del mazo
// (una venta, un reporte) puede sacar o meter leads.
export default function useEmbudo(refreshKey = 0) {
    const [datos, setDatos] = useState(leerCache(CLAVE)?.datos || null);
    const [ultimo, setUltimo] = useState(null);
    const [ocupado, setOcupado] = useState(false);

    const cargar = useCallback(async () => {
        try {
            const res = await api.get('/closer/embudo');
            setDatos(res.data);
            guardarCache(CLAVE, res.data);
        } catch (err) {
            console.error('Error cargando el embudo', err);
            setDatos(prev => prev || { error: true });
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar, refreshKey]);

    const registrar = useCallback(async (tarjeta, resultado, texto) => {
        setOcupado(true);
        try {
            const res = await api.post(`/closer/embudo/${tarjeta.id}/registrar`, { resultado });
            setUltimo({ regId: res.data.id, texto });
            await cargar();
        } catch (err) {
            toast.error(errorDe(err, 'No se pudo registrar'));
        } finally {
            setOcupado(false);
        }
    }, [cargar]);

    const deshacer = useCallback(async () => {
        if (!ultimo) return;
        setOcupado(true);
        try {
            await api.delete(`/closer/embudo/registros/${ultimo.regId}`);
            setUltimo(null);
            await cargar();
        } catch (err) {
            toast.error(errorDe(err, 'No se pudo deshacer'));
        } finally {
            setOcupado(false);
        }
    }, [ultimo, cargar]);

    const guardarDias = useCallback(async (dias) => {
        try {
            await api.put('/closer/embudo/config', { dias });
            await cargar();
            return true;
        } catch (err) {
            toast.error(errorDe(err, 'No se pudieron guardar los días'));
            return false;
        }
    }, [cargar]);

    return { datos, ultimo, ocupado, registrar, deshacer, guardarDias, olvidarUltimo: () => setUltimo(null) };
}
