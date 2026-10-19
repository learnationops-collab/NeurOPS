// La conversación con Learnito. La API de Claude no guarda estado: se manda el historial entero en
// cada turno (solo el texto; el servidor lo acota, app/api/copiloto.py). `uso` es lo gastado en el
// mes contra el tope de cada persona; llega con cada respuesta y con `cargarUso`.
import { useCallback, useMemo, useState } from 'react';
import api from '../../services/api';

export const MAX_MENSAJES = 10;

export function useCopiloto() {
    const [mensajes, setMensajes] = useState([]);
    const [enviando, setEnviando] = useState(false);
    const [uso, setUso] = useState(null);

    const cargarUso = useCallback(() => {
        api.get('/copiloto/uso').then(({ data }) => setUso(data)).catch(() => {});
    }, []);

    // Devuelve null si salió bien, o el mensaje de error para mostrar.
    const enviar = useCallback(async (texto) => {
        const anteriores = mensajes;
        const conversacion = [...anteriores, { role: 'user', content: texto }];
        setMensajes(conversacion);
        setEnviando(true);
        try {
            const { data } = await api.post('/copiloto/mensaje', { mensajes: conversacion });
            setMensajes([...conversacion, { role: 'assistant', content: data.texto }]);
            if (data.uso) setUso(data.uso);
            return null;
        } catch (err) {
            setMensajes(anteriores);
            if (err.response?.data?.uso) setUso(err.response.data.uso);
            return err.response?.data?.error || 'No se pudo hablar con Learnito.';
        } finally {
            setEnviando(false);
        }
    }, [mensajes]);

    const reiniciar = useCallback(() => setMensajes([]), []);

    return useMemo(() => ({
        mensajes, enviando, enviar, reiniciar, uso, cargarUso,
        lleno: mensajes.length >= MAX_MENSAJES - 1,
        agotado: (uso?.porcentaje ?? 0) >= 100,
    }), [mensajes, enviando, enviar, reiniciar, uso, cargarUso]);
}
