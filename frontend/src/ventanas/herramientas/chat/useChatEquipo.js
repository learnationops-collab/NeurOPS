// El canal General · Equipo de la Academia (app/api/chat.py, ADR-W171 y W174): trae los últimos mensajes y, cada
// 4 s, los nuevos desde el último id. Minimizada, consulta cada 30 s (para contar lo nuevo). Los conectados, cada
// 30 s; la gente para el @, una vez. Reaccionar, buscar y compartir una respuesta de Learnito van por acá.
// Los errores no abren el aviso de bugs: el chat los muestra en su barra.
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../services/api';

const CADA_MS = 4000;
const MINIMIZADA_MS = 30000;
const CONECTADOS_MS = 30000;
const SILENCIOSO = { skipBugReport: true };

const unir = (previos, nuevos) => {
    const vistos = new Set((previos || []).map(m => m.id));
    return [...(previos || []), ...nuevos.filter(m => !vistos.has(m.id))];
};
const reemplazar = (lista, m) => (lista || []).map(x => (x.id === m.id ? m : x));

export default function useChatEquipo({ minimizada, mirando }) {
    const [mensajes, setMensajes] = useState(null);      // null = cargando
    const [conectados, setConectados] = useState(null);
    const [personas, setPersonas] = useState([]);
    const [error, setError] = useState(null);
    const [nuevos, setNuevos] = useState(0);              // de otros, mientras no se mira el canal
    const ultimo = useRef(0);
    const mirandoRef = useRef(mirando);
    useEffect(() => { mirandoRef.current = mirando; }, [mirando]);

    const traer = useCallback(async () => {
        if (document.hidden && ultimo.current) return;
        try {
            const { data } = await api.get('/chat/canal', { params: { desde: ultimo.current }, ...SILENCIOSO });
            const llegaron = data.mensajes || [];
            const primeraVez = !ultimo.current;
            setMensajes(prev => unir(prev, llegaron));
            // Lo nuevo cuenta mientras no se mira el canal; mirándolo, vuelve a cero.
            if (mirandoRef.current) setNuevos(0);
            else if (!primeraVez) setNuevos(n => n + llegaron.filter(m => !m.mio).length);
            ultimo.current = Math.max(ultimo.current, data.ultimo_id || 0);
            setError(null);
        } catch (e) {
            setMensajes(prev => prev ?? []);
            setError(e.response?.data?.error || 'El chat no responde. Probá en un rato.');
        }
    }, []);

    const traerConectados = useCallback(async () => {
        try {
            const { data } = await api.get('/chat/conectados', SILENCIOSO);
            setConectados(data.conectados || []);
        } catch {
            setConectados(prev => prev ?? []);
        }
    }, []);

    useEffect(() => {
        traer();
        const id = setInterval(traer, minimizada ? MINIMIZADA_MS : CADA_MS);
        return () => clearInterval(id);
    }, [traer, minimizada]);

    useEffect(() => {
        traerConectados();
        const id = setInterval(traerConectados, CONECTADOS_MS);
        return () => clearInterval(id);
    }, [traerConectados]);

    useEffect(() => {
        api.get('/chat/personas', SILENCIOSO).then(({ data }) => setPersonas(data.personas || [])).catch(() => {});
    }, []);

    // No se mueve `ultimo` al enviar: si alguien escribió justo antes, la próxima consulta lo trae.
    const enviar = useCallback(async (texto, { parentId, menciones, como } = {}) => {
        const { data } = await api.post('/chat/enviar', { texto, parent_id: parentId || undefined, menciones, como });
        if (data.mensaje) setMensajes(prev => unir(prev, [data.mensaje]));
        return data.mensaje || null;
    }, []);

    const reaccionar = useCallback(async (id, clave) => {
        const { data } = await api.post('/chat/reaccion', { id, clave });
        if (data.mensaje) setMensajes(prev => reemplazar(prev, data.mensaje));
    }, []);

    /** Los 50 más recientes que tienen el texto (lo resuelve la Academia, en todo el canal). */
    const buscar = useCallback(async (texto) => {
        const { data } = await api.get('/chat/canal', { params: { buscar: texto }, ...SILENCIOSO });
        return data.mensajes || [];
    }, []);

    return { mensajes, conectados, personas, error, nuevos, enviar, reaccionar, buscar };
}
