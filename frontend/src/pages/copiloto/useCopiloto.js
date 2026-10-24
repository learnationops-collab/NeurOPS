// La conversación con Learnito. Dos modos, según `uso.modo` (app/api/copiloto.py):
// - local (closers): la API de Claude no guarda estado, así que se manda el historial entero en cada turno (solo el
//   texto; el servidor lo acota). `uso` es lo gastado en el mes contra el tope de cada persona.
// - cerebro (la dirección): la conversación la guarda el cerebro de Learnito en la Academia; acá viaja solo la
//   pregunta (o el botón que se tocó) y el id de la conversación. Cada respuesta trae su mensaje entero (texto en
//   markdown, botones, opciones) y el uso del mes.
import { useCallback, useMemo, useState } from 'react';
import api from '../../services/api';

export const MAX_MENSAJES = 10;

export function useCopiloto() {
    const [mensajes, setMensajes] = useState([]);
    const [enviando, setEnviando] = useState(false);
    const [uso, setUso] = useState(null);
    const [modo, setModo] = useState(null);
    const [conversacion, setConversacion] = useState(null);
    const [calificacion, setCalificacion] = useState(null);

    const cargarUso = useCallback(() => {
        api.get('/copiloto/uso').then(({ data }) => {
            setModo(data.modo || 'local');
            if (data.modo !== 'cerebro') setUso(data);
        }).catch(() => {});
    }, []);

    // Al cerebro: una pregunta o un botón. `muestra` es lo que se ve del lado de la persona.
    const alCerebro = useCallback(async (pedido, muestra) => {
        const anteriores = mensajes;
        setMensajes([...anteriores, { role: 'user', content: muestra }]);
        setEnviando(true);
        try {
            const { data } = await api.post('/copiloto/learnito', { ...pedido, conversacion_id: conversacion || undefined });
            setConversacion(data.conversacion_id);
            setMensajes([...anteriores, { role: 'user', content: muestra },
                { role: 'assistant', content: data.mensaje?.text || '', mensaje: data.mensaje, indice: data.mensaje_indice }]);
            if (data.uso) setUso(data.uso);
            return null;
        } catch (err) {
            setMensajes(anteriores);
            return err.response?.data?.error || 'No se pudo hablar con Learnito.';
        } finally {
            setEnviando(false);
        }
    }, [mensajes, conversacion]);

    // Devuelve null si salió bien, o el mensaje de error para mostrar.
    const enviar = useCallback(async (texto) => {
        if (modo === 'cerebro') return alCerebro({ pregunta: texto }, texto);
        const anteriores = mensajes;
        const historial = [...anteriores, { role: 'user', content: texto }];
        setMensajes(historial);
        setEnviando(true);
        try {
            const { data } = await api.post('/copiloto/mensaje', { mensajes: historial });
            setMensajes([...historial, { role: 'assistant', content: data.texto }]);
            if (data.uso) setUso(data.uso);
            return null;
        } catch (err) {
            setMensajes(anteriores);
            if (err.response?.data?.uso) setUso(err.response.data.uso);
            return err.response?.data?.error || 'No se pudo hablar con Learnito.';
        } finally {
            setEnviando(false);
        }
    }, [modo, mensajes, alCerebro]);

    // Un botón (tipo "boton") o una opción (tipo "opcion") de la respuesta `indice` del cerebro.
    const tocar = useCallback((indice, tipo, i, texto) => alCerebro({ boton: { mensaje: indice, tipo, indice: i } }, texto),
        [alCerebro]);

    const calificar = useCallback(async (valor) => {
        if (!conversacion) return;
        const antes = calificacion;
        const nueva = valor === antes ? null : valor;
        setCalificacion(nueva);
        try {
            await api.post('/copiloto/learnito/calificar', { conversacion_id: conversacion, calificacion: nueva });
        } catch {
            setCalificacion(antes);
        }
    }, [conversacion, calificacion]);

    const reiniciar = useCallback(() => {
        setMensajes([]);
        setConversacion(null);
        setCalificacion(null);
    }, []);

    return useMemo(() => ({
        mensajes, enviando, enviar, tocar, reiniciar, uso, cargarUso, modo, calificacion, calificar,
        // Con el cerebro no hay límite de mensajes: la Academia resume las conversaciones largas.
        lleno: modo !== 'cerebro' && mensajes.length >= MAX_MENSAJES - 1,
        agotado: (uso?.porcentaje ?? 0) >= 100,
    }), [mensajes, enviando, enviar, tocar, reiniciar, uso, cargarUso, modo, calificacion, calificar]);
}
