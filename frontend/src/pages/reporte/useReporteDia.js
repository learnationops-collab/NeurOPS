// Estado de un día del reporte: GET /api/reporte/dia, autoguardado con PUT (600 ms después de la
// última tecla) y resultado de agendas pendientes. Lo local manda: el eco del servidor nunca pisa un
// campo que la persona está escribiendo.
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const ESPERA_MS = 600;

const fusionar = (a, b) => {
    if (!a) return { ...b };
    const n = { ...a, ...b };
    ['victoria', 'manana', 'mano', 'correcciones'].forEach((k) => { if (a[k] && b[k]) n[k] = { ...a[k], ...b[k] }; });
    return n;
};

// Pone `v` en cada número con esa clave (kpis, embudo, bloques, tasas).
function conValores(numeros, valores) {
    if (!numeros || !valores) return numeros;
    const fijar = (o) => (o && o.clave && o.clave in valores ? { ...o, v: valores[o.clave] } : o);
    const lista = (xs) => (Array.isArray(xs) ? xs.map(fijar) : xs);
    return {
        ...numeros,
        kpis: lista(numeros.kpis),
        tasas: lista(numeros.tasas),
        embudo: numeros.embudo && { ...numeros.embudo, pasos: lista(numeros.embudo.pasos) },
        bloques: (numeros.bloques || []).map((b) => ({
            ...b,
            filas: b.filas?.map((f) => ({ ...f, celdas: lista(f.celdas) })),
            total: fijar(b.total), partes: lista(b.partes), pie: lista(b.pie), items: lista(b.items),
            series: b.series?.map((s) => ({ ...s, pasos: lista(s.pasos) })),
        })),
    };
}

// El cambio aplicado al día que se ve, antes de que conteste el servidor.
function aplicar(d, p) {
    if (!d || !p) return d;
    const n = { ...d };
    if (p.victoria) n.victoria = { ...d.victoria, ...p.victoria };
    if (p.manana) n.manana = { ...d.manana, ...p.manana };
    if ('no_laborable' in p) n.no_laborable = p.no_laborable;
    if (p.mano) {
        n.pendientes = { ...d.pendientes, mano: (d.pendientes?.mano || []).map((m) => (m.clave in p.mano ? { ...m, valor: p.mano[m.clave], sugerido: false } : m)) };
        n.numeros = conValores(n.numeros, p.mano);
    }
    if (p.correcciones) n.numeros = conValores(n.numeros, p.correcciones);
    return n;
}

export default function useReporteDia({ userId, onDia } = {}) {
    const [fecha, setFecha] = useState(null); // null = hoy (lo decide el backend)
    const [dia, setDia] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [resueltas, setResueltas] = useState({}); // { id: { agenda, resultado } }
    const diaRef = useRef(null);
    const pend = useRef(null); // { fecha, patch } sin mandar
    const timer = useRef(null);
    const enviando = useRef(false);
    const onDiaRef = useRef(onDia);
    onDiaRef.current = onDia;
    const extra = userId ? { user_id: userId } : {};
    const extraRef = useRef(extra);
    extraRef.current = extra;

    const poner = useCallback((d) => { diaRef.current = d; setDia(d); }, []);

    // Eco del servidor: lo que sigue sin mandar se vuelve a aplicar encima, y los textos de la
    // victoria y del «mañana» quedan como están en pantalla.
    const alEco = useCallback((server) => {
        if (!server) return;
        onDiaRef.current?.(server);
        const local = diaRef.current;
        if (!local || local.fecha !== server.fecha) return;
        let n = server;
        if (pend.current?.fecha === server.fecha) n = aplicar(n, pend.current.patch);
        n = { ...n, victoria: { ...n.victoria, ...local.victoria }, manana: { ...n.manana, ...local.manana } };
        poner(n);
    }, [poner]);

    const enviar = useCallback(async () => {
        clearTimeout(timer.current);
        timer.current = null;
        if (enviando.current || !pend.current) return;
        const { fecha: f, patch } = pend.current;
        pend.current = null;
        enviando.current = true;
        let fallo = false;
        try {
            const res = await api.put('/reporte/dia', { fecha: f, ...patch }, { params: extraRef.current });
            alEco(res.data);
        } catch (e) {
            fallo = true;
            console.error(`Error al guardar el reporte: ${e}`);
            // Lo que no se guardó vuelve a la cola para el próximo intento.
            pend.current = pend.current ? { fecha: f, patch: fusionar(patch, pend.current.patch) } : { fecha: f, patch };
            toast.error(e.response?.data?.error || 'No se pudo guardar. Se reintenta al seguir escribiendo.');
        } finally {
            enviando.current = false;
            // Lo que se escribió mientras viajaba el pedido sale enseguida; un error espera a la próxima tecla.
            if (!fallo && pend.current && !timer.current) timer.current = setTimeout(() => { timer.current = null; enviar(); }, ESPERA_MS);
        }
    }, [alEco]);

    // Cambio parcial: { victoria?, manana?, mano?, correcciones?, no_laborable? }. `ya` lo manda sin esperar.
    const editar = useCallback((patch, ya = false) => {
        const d = diaRef.current;
        if (!d) return;
        poner(aplicar(d, patch));
        pend.current = pend.current && pend.current.fecha === d.fecha
            ? { fecha: d.fecha, patch: fusionar(pend.current.patch, patch) }
            : { fecha: d.fecha, patch };
        clearTimeout(timer.current);
        timer.current = null;
        if (ya) enviar();
        else timer.current = setTimeout(() => { timer.current = null; enviar(); }, ESPERA_MS);
    }, [enviar, poner]);

    // Cargar el día (al entrar o al cambiar de día). Antes se manda lo pendiente del anterior.
    useEffect(() => {
        let vivo = true;
        if (pend.current) enviar();
        setCargando(true);
        setResueltas({});
        api.get('/reporte/dia', { params: { ...(fecha ? { fecha } : {}), ...extraRef.current } })
            .then((res) => { if (vivo) { poner(res.data); setError(null); onDiaRef.current?.(res.data); } })
            .catch((e) => { if (vivo) { console.error(`Error al cargar el reporte: ${e}`); setError(e.response?.data?.error || 'No se pudo cargar el reporte.'); } })
            .finally(() => { if (vivo) setCargando(false); });
        return () => { vivo = false; };
    }, [fecha, userId, enviar, poner]);

    // Al salir de la sección, lo que quedó sin mandar se manda igual.
    useEffect(() => () => { if (pend.current) enviar(); }, [enviar]);

    // Devuelve {pregunta} cuando el resultado necesita un motivo (No show, Reagendado, Cancelado) y no vino.
    const cargarResultado = useCallback(async (agenda, resultado, motivo) => {
        const d = diaRef.current;
        if (!d || !resultado) return null;
        setResueltas((r) => ({ ...r, [agenda.id]: { agenda, resultado } }));
        const quitar = () => setResueltas((r) => { const n = { ...r }; delete n[agenda.id]; return n; });
        try {
            const res = await api.post('/reporte/agenda-resultado', { appointment_id: agenda.id, resultado, motivo, fecha: d.fecha }, { params: extraRef.current });
            alEco(res.data);
            return null;
        } catch (e) {
            quitar();
            const data = e.response?.data;
            if (e.response?.status === 400 && data?.campo === 'motivo') return { pregunta: data.pregunta || data.error || 'Contá el motivo' };
            console.error(`Error al cargar el resultado: ${e}`);
            toast.error(data?.error || 'No se pudo cargar el resultado.');
            return null;
        }
    }, [alEco]);

    // Ver otro día: null o la fecha de hoy = hoy.
    const verDia = useCallback((f) => {
        const hoy = diaRef.current?.hoy;
        setFecha(!f || f === hoy ? null : f);
    }, []);

    return { dia, cargando, error, editar, cargarResultado, resueltas, verDia, fecha };
}
