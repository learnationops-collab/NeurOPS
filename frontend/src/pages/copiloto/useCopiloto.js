// La conversación con el copiloto. La API de Claude no guarda estado: se manda el historial entero
// en cada turno, y el servidor lo acota (app/api/copiloto.py).
import { useState } from 'react';
import api from '../../services/api';

export const MAX_MENSAJES = 20;

export function useCopiloto() {
    const [mensajes, setMensajes] = useState([]);
    const [enviando, setEnviando] = useState(false);

    // Devuelve null si salió bien, o el mensaje de error para mostrar.
    const enviar = async (texto) => {
        const conversacion = [...mensajes, { role: 'user', content: texto }];
        setMensajes(conversacion);
        setEnviando(true);
        try {
            const { data } = await api.post('/copiloto/mensaje', { mensajes: conversacion });
            setMensajes([...conversacion, { role: 'assistant', content: data.texto }]);
            return null;
        } catch (err) {
            setMensajes(mensajes);
            return err.response?.data?.error || 'No se pudo hablar con el copiloto.';
        } finally {
            setEnviando(false);
        }
    };

    return {
        mensajes,
        enviando,
        enviar,
        reiniciar: () => setMensajes([]),
        lleno: mensajes.length >= MAX_MENSAJES - 1,
    };
}
