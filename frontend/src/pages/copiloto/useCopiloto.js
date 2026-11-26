// La conversación con Learnito (app/api/copiloto.py). La guarda el cerebro de Learnito en la Academia: acá viaja
// solo la pregunta (o el botón que se tocó) y el id de la conversación. Cada respuesta trae su mensaje entero (texto
// en markdown, botones, opciones, gráficos adjuntos y la acción propuesta, si hay) y el uso: del mes y de la
// conversación (`uso.conversacion`: {porcentaje, agotada}). Dos reglas del cerebro (24/10): una conversación agotada
// no acepta más preguntas, y para abrir otra hay que calificar las anteriores (`pendientes`, se califican acá).
import { useCallback, useMemo, useRef, useState } from 'react';
import api from '../../services/api';

export function useCopiloto() {
    const [mensajes, setMensajes] = useState([]);
    // El texto de la última respuesta, para quien la necesita apenas termina `enviar` (el @Learnito del chat, ADR-W174).
    const ultima = useRef('');
    const [enviando, setEnviando] = useState(false);
    const [uso, setUso] = useState(null);
    const [conversacion, setConversacion] = useState(null);
    const [calificacion, setCalificacion] = useState(null);
    const [pendientes, setPendientes] = useState([]);
    const [historial, setHistorial] = useState([]);

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
    // `nueva`: arranca otra conversación en el mismo pedido (el Inbox, con otro lead; reiniciar() + enviar() en el
    // mismo clic usaría la conversación vieja, porque el estado todavía no cambió).
    const alCerebro = useCallback(async (pedido, muestra, nueva = false, archivos = []) => {
        const anteriores = nueva ? [] : mensajes;
        if (nueva) { setCalificacion(null); setUso((u) => (u ? { ...u, conversacion: null } : u)); }
        const propio = { role: 'user', content: muestra, archivos: archivos.length ? archivos : undefined };
        setMensajes([...anteriores, propio]);
        setEnviando(true);
        try {
            const { data } = await api.post('/copiloto/learnito', { ...pedido, conversacion_id: (!nueva && conversacion) || undefined });
            setConversacion(data.conversacion_id);
            ultima.current = data.mensaje?.text || '';
            setMensajes([...anteriores, propio,
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
    // `adjuntos` (ADR-W252): [{nombre, tipo, datos en base64, url}] (useAdjuntos); la url queda solo para verlos acá.
    const enviar = useCallback((texto, muestra = texto, { nueva = false, adjuntos = [] } = {}) => alCerebro(
        { pregunta: texto, ...(adjuntos.length ? { adjuntos: adjuntos.map(({ nombre, tipo, datos }) => ({ nombre, tipo, datos })) } : {}) },
        muestra, nueva, adjuntos), [alCerebro]);

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

    // Se elige la cara y se manda con «Enviar» (con una nota opcional): devuelve null o el error (26/11/2026).
    const calificar = useCallback(async (valor, nota = '') => {
        if (!conversacion) return 'No hay conversación para calificar.';
        try {
            await api.post('/copiloto/learnito/calificar', { conversacion_id: conversacion, calificacion: valor, nota: nota.trim() || undefined });
            setCalificacion(valor);
            setPendientes((l) => l.filter((x) => x.id !== conversacion));
            setHistorial((h) => h.map((c) => (c.id === conversacion ? { ...c, calificacion: valor } : c)));
            return null;
        } catch (err) {
            return err.response?.data?.error || 'No se pudo enviar la calificación.';
        }
    }, [conversacion]);

    // El sidebar (ADR-W251): las conversaciones de quien pregunta, las fijadas arriba; abrir una la trae entera.
    const cargarHistorial = useCallback(() => {
        api.get('/copiloto/learnito/historial').then(({ data }) => setHistorial(data.conversaciones || [])).catch(() => {});
    }, []);

    const abrir = useCallback(async (id) => {
        try {
            const { data } = await api.get(`/copiloto/learnito/historial/${id}`);
            const c = data.conversacion;
            setMensajes((c.mensajes || []).filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => (m.role === 'user'
                ? { role: 'user', content: m.text || '', archivos: m.archivos }
                : { role: 'assistant', content: m.text || '', mensaje: m, indice: m.indice })));
            setConversacion(c.id);
            setCalificacion(c.calificacion || null);
            setUso((u) => ({ ...(u || {}), conversacion: { porcentaje: c.porcentaje, agotada: c.agotada } }));
            return null;
        } catch (err) {
            return err.response?.data?.error || 'No se pudo abrir la conversación.';
        }
    }, []);

    // Borrar (ADR-W252): la Academia la archiva. Si era la abierta, se arranca otra.
    const borrar = useCallback(async (id) => {
        try {
            await api.delete(`/copiloto/learnito/historial/${id}`);
            setHistorial((h) => h.filter((c) => c.id !== id));
            setPendientes((l) => l.filter((x) => x.id !== id));
            if (id === conversacion) { setMensajes([]); setConversacion(null); setCalificacion(null); setUso((u) => (u ? { ...u, conversacion: null } : u)); }
            return null;
        } catch (err) {
            return err.response?.data?.error || err.response?.data?.mensaje || 'No se pudo borrar.';
        }
    }, [conversacion]);

    // Renombrar ({titulo}) o fijar ({fijada}): se ve al toque y vuelve atrás si falla.
    const ordenar = useCallback(async (id, cambios) => {
        const antes = historial;
        setHistorial((h) => {
            const lista = h.map((c) => (c.id === id ? { ...c, ...cambios } : c));
            return [...lista.filter((c) => c.fijada), ...lista.filter((c) => !c.fijada)];
        });
        try {
            const { data } = await api.patch(`/copiloto/learnito/historial/${id}`, cambios);
            if ('titulo' in cambios && !data.titulo) cargarHistorial();
        } catch {
            setHistorial(antes);
        }
    }, [historial, cargarHistorial]);

    const reiniciar = useCallback(() => {
        setMensajes([]);
        setConversacion(null);
        setCalificacion(null);
        setUso((u) => (u ? { ...u, conversacion: null } : u));
        cargarPendientes();
    }, [cargarPendientes]);

    const agotada = Boolean(conversacion && uso?.conversacion?.agotada);
    const ultimaRespuesta = useCallback(() => ultima.current, []);
    return useMemo(() => ({
        mensajes, enviando, enviar, tocar, confirmar, reiniciar, uso, calificacion, calificar, ultimaRespuesta,
        pendientes, cargarPendientes, calificarPendiente, agotada, conversacion, historial, cargarHistorial, abrir, ordenar, borrar,
        // Sin conversación abierta, las anteriores sin calificar traban la nueva.
        trabado: !conversacion && pendientes.length > 0,
        agotado: (uso?.porcentaje ?? 0) >= 100 || agotada,
    }), [mensajes, enviando, enviar, tocar, confirmar, reiniciar, uso, calificacion, calificar, ultimaRespuesta,
        pendientes, cargarPendientes, calificarPendiente, agotada, conversacion, historial, cargarHistorial, abrir, ordenar, borrar]);
}
