// La conversación con el copiloto. La API de Claude no guarda estado: se manda el historial entero
// en cada turno, y el servidor lo acota (app/api/copiloto.py).
import { useCallback, useMemo, useState } from 'react';
import api from '../../services/api';

export const MAX_MENSAJES = 20;

export function useCopiloto() {
    const [mensajes, setMensajes] = useState([]);
    const [enviando, setEnviando] = useState(false);

    // Devuelve null si salió bien, o el mensaje de error para mostrar.
    const enviar = useCallback(async (texto) => {
        const anteriores = mensajes;
        const conversacion = [...anteriores, { role: 'user', content: texto }];
        setMensajes(conversacion);
        setEnviando(true);
        try {
            const { data } = await api.post('/copiloto/mensaje', { mensajes: conversacion });
            setMensajes([...conversacion, { role: 'assistant', content: data.texto }]);
            return null;
        } catch (err) {
            setMensajes(anteriores);
            return err.response?.data?.error || 'No se pudo hablar con el copiloto.';
        } finally {
            setEnviando(false);
        }
    }, [mensajes]);

    const reiniciar = useCallback(() => setMensajes([]), []);

    return useMemo(() => ({
        mensajes, enviando, enviar, reiniciar, lleno: mensajes.length >= MAX_MENSAJES - 1,
    }), [mensajes, enviando, enviar, reiniciar]);
}
