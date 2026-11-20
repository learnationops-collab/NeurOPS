// El chat del equipo de la Academia (app/api/chat.py, ADR-W171, W174 y W175). La conversación abierta es General ·
// Equipo (`con` = null) o la directa con alguien (`con` = su correo): trae los últimos mensajes y, cada 4 s, los
// nuevos desde el último id. Minimizada, cada 30 s. Los conectados y la bandeja (lo no leído de cada conversación),
// cada 30 s; la gente para el @, una vez. Reaccionar, buscar y compartir una respuesta de Learnito van por acá.
// Los errores no abren el aviso de bugs: el chat los muestra en su barra.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../services/api';
import { publicarSinLeer, totalSinLeer } from './usePresencia';

const CADA_MS = 4000;
const MINIMIZADA_MS = 30000;
const LISTA_MS = 30000;
const SILENCIOSO = { skipBugReport: true };

const unir = (previos, nuevos) => {
    const vistos = new Set((previos || []).map(m => m.id));
    return [...(previos || []), ...nuevos.filter(m => !vistos.has(m.id))];
};
const reemplazar = (lista, m) => (lista || []).map(x => (x.id === m.id ? m : x));

export default function useChatEquipo({ minimizada, con = null }) {
    const [mensajes, setMensajes] = useState(null);      // null = cargando
    const [conectados, setConectados] = useState(null);
    const [desconectados, setDesconectados] = useState([]);   // vistos en los últimos 30 días, el más reciente arriba
    const [bandeja, setBandeja] = useState({ equipo: 0, directos: [] });
    const [personas, setPersonas] = useState([]);
    const [error, setError] = useState(null);
    const ultimo = useRef(0);
    const conRef = useRef(con);
    const params = useCallback((extra) => ({ ...(conRef.current ? { con: conRef.current } : {}), ...extra }), []);

    const traer = useCallback(async () => {
        if (document.hidden && ultimo.current) return;
        const pedida = conRef.current;
        try {
            const { data } = await api.get('/chat/canal', { params: params({ desde: ultimo.current }), ...SILENCIOSO });
            if (pedida !== conRef.current) return;          // cambió de conversación mientras esperaba
            setMensajes(prev => unir(prev, data.mensajes || []));
            ultimo.current = Math.max(ultimo.current, data.ultimo_id || 0);
            setError(null);
        } catch (e) {
            if (pedida !== conRef.current) return;
            setMensajes(prev => prev ?? []);
            setError(e.response?.data?.error || 'El chat no responde. Probá en un rato.');
        }
    }, [params]);

    const traerLista = useCallback(async () => {
        const [c, b] = await Promise.allSettled([api.get('/chat/conectados', SILENCIOSO), api.get('/chat/bandeja', SILENCIOSO)]);
        setConectados(c.status === 'fulfilled' ? c.value.data.conectados || [] : (prev => prev ?? []));
        if (c.status === 'fulfilled') setDesconectados(c.value.data.desconectados || []);
        if (b.status === 'fulfilled') {
            const equipo = (b.value.data.canales || []).find(x => x.slug === 'equipo');
            setBandeja({ equipo: equipo?.sin_leer || 0, directos: b.value.data.directos || [] });
        }
    }, []);

    // Otra conversación: empieza de cero (el estado, al dibujar; las referencias y la consulta, en el efecto).
    const [deCon, setDeCon] = useState(con);
    if (deCon !== con) {
        setDeCon(con);
        setMensajes(null);
        setError(null);
    }
    useEffect(() => {
        conRef.current = con;
        ultimo.current = 0;
        traer();
        const id = setInterval(traer, minimizada ? MINIMIZADA_MS : CADA_MS);
        return () => clearInterval(id);
    }, [traer, minimizada, con]);

    // La abierta queda leída en la Academia: acá no cuenta, sin esperar la próxima bandeja.
    const lista = useMemo(() => (con
        ? { ...bandeja, directos: bandeja.directos.map(d => (d.con.email === con ? { ...d, sin_leer: 0 } : d)) }
        : { ...bandeja, equipo: 0 }), [bandeja, con]);
    useEffect(() => { publicarSinLeer(totalSinLeer(lista)); }, [lista]);

    useEffect(() => {
        traerLista();
        const id = setInterval(traerLista, LISTA_MS);
        return () => clearInterval(id);
    }, [traerLista]);

    useEffect(() => {
        api.get('/chat/personas', SILENCIOSO).then(({ data }) => setPersonas(data.personas || [])).catch(() => {});
    }, []);

    // No se mueve `ultimo` al enviar: si alguien escribió justo antes, la próxima consulta lo trae.
    const enviar = useCallback(async (texto, { parentId, menciones, como } = {}) => {
        const { data } = await api.post('/chat/enviar', params({ texto, parent_id: parentId || undefined, menciones, como }));
        if (data.mensaje) setMensajes(prev => unir(prev, [data.mensaje]));
        if (conRef.current) traerLista();                  // una directa nueva entra a la lista
        return data.mensaje || null;
    }, [params, traerLista]);

    const reaccionar = useCallback(async (id, clave) => {
        const { data } = await api.post('/chat/reaccion', { id, clave });
        if (data.mensaje) setMensajes(prev => reemplazar(prev, data.mensaje));
    }, []);

    /** Los 50 más recientes que tienen el texto (lo resuelve la Academia, en toda la conversación). */
    const buscar = useCallback(async (texto) => {
        const { data } = await api.get('/chat/canal', { params: params({ buscar: texto }), ...SILENCIOSO });
        return data.mensajes || [];
    }, [params]);

    return { mensajes, conectados, desconectados, bandeja: lista, personas, error, enviar, reaccionar, buscar };
}
