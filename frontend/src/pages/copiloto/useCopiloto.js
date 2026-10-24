// La conversación con Learnito (app/api/copiloto.py). La guarda el cerebro de Learnito en la Academia: acá viaja
// solo la pregunta (o el botón que se tocó) y el id de la conversación. Cada respuesta trae su mensaje entero (texto
// en markdown, botones, opciones, gráficos adjuntos y la acción propuesta, si hay) y el uso: del mes y de la
// conversación (`uso.conversacion`: {porcentaje, agotada}). Dos reglas del cerebro (24/10): una conversación agotada
// no acepta más preguntas, y para abrir otra hay que calificar las anteriores (`pendientes`, se califican acá).
import { useCallback, useMemo, useState } from 'react';
import api from '../../services/api';

export function useCopiloto() {
    const [mensajes, setMensajes] = useState([]);
    const [enviando, setEnviando] = useState(false);
    const [uso, setUso] = useState(null);
    const [conversacion, setConversacion] = useState(null);
    const [calificacion, setCalificacion] = useState(null);
    const [pendientes, setPendientes] = useState([]);

    const cargarPendientes = useCallback(() => {
        api.get('/copiloto/learnito/pendientes').then(({ data }) => setPendientes(data.pendientes || [])).catch(() => {});
    }, []);

    // Califica una conversación anterior sin abrirla; sale de la lista.
    const calificarPendiente = useCallback(async (id, valor) => {
        try {
            await api.post('/copiloto/learnito/calificar', { conversacion_id: id, calificacion: valor });
            setPendientes((lista) => lista.filter((p) => p.id !== id));
        } catch {
            // queda en la lista para volver a intentar
        }
    }, []);

    // Una pregunta o un botón. `muestra` es lo que se ve del lado de la persona. Devuelve null o el error.
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
            const datos = err.response?.data || {};
            if (datos.codigo === 'calificar_pendientes') setPendientes(datos.pendientes || []);
            if (datos.codigo === 'conversacion_agotada') {
                setUso((u) => ({ ...u, conversacion: { ...(u?.conversacion || {}), agotada: true, porcentaje: 100 } }));
            }
            return datos.error || 'No se pudo hablar con Learnito.';
        } finally {
            setEnviando(false);
        }
    }, [mensajes, conversacion]);

    // `muestra` es lo que se ve: la pregunta viaja con los nombrados como "@[Nombre, id N]" (menciones.js).
    const enviar = useCallback((texto, muestra = texto) => alCerebro({ pregunta: texto }, muestra), [alCerebro]);

    // Un botón (tipo "boton") o una opción (tipo "opcion") de la respuesta `indice` del cerebro.
    const tocar = useCallback((indice, tipo, i, texto) => alCerebro({ boton: { mensaje: indice, tipo, indice: i } }, texto),
        [alCerebro]);

    // Confirma (con el texto editado) o descarta la acción de la respuesta en la posición `pos` de la lista.
    const confirmar = useCallback(async (pos, { texto, descartar } = {}) => {
        const m = mensajes[pos];
        if (!conversacion || m?.indice == null) return 'No se encontró la respuesta.';
        try {
            const { data } = await api.post('/copiloto/learnito/confirmar', {
                conversacion_id: conversacion, mensaje: m.indice, ...(descartar ? { descartar: true } : { texto }),
            });
            setMensajes((lista) => lista.map((x, i) => (i === pos ? { ...x, mensaje: { ...x.mensaje, accion: data.accion } } : x)));
            return null;
        } catch (err) {
            return err.response?.data?.error || 'No se pudo hacer.';
        }
    }, [mensajes, conversacion]);

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
        setUso((u) => (u ? { ...u, conversacion: null } : u));
        cargarPendientes();
    }, [cargarPendientes]);

    const agotada = Boolean(conversacion && uso?.conversacion?.agotada);
    return useMemo(() => ({
        mensajes, enviando, enviar, tocar, confirmar, reiniciar, uso, calificacion, calificar,
        pendientes, cargarPendientes, calificarPendiente, agotada,
        // Sin conversación abierta, las anteriores sin calificar traban la nueva.
        trabado: !conversacion && pendientes.length > 0,
        agotado: (uso?.porcentaje ?? 0) >= 100 || agotada,
    }), [mensajes, enviando, enviar, tocar, confirmar, reiniciar, uso, calificacion, calificar,
        pendientes, cargarPendientes, calificarPendiente, agotada, conversacion]);
}
