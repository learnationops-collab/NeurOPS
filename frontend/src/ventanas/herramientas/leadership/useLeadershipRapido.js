// Leadership rápido (app/api/leadership_rapido.py → /api/v1/rapido de Leadership): el panel de la persona,
// las opciones del formulario (una vez) y un `pedir` para las acciones, que después recarga el panel.
// Abierta, recarga cada minuto; minimizada, no consulta. Los errores no abren el aviso de bugs: la ventana
// los muestra.
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../services/api';

const BASE = '/leadership/rapido';
const SILENCIOSO = { skipBugReport: true };
const CADA_MS = 60000;

export const mensajeDe = (e) => e?.response?.data?.mensaje || 'Leadership no responde. Probá en un rato.';

export default function useLeadershipRapido({ activa }) {
    const [panel, setPanel] = useState(null);       // null = cargando
    const [opciones, setOpciones] = useState(null);
    const [error, setError] = useState(null);
    const pidiendoOpciones = useRef(false);

    const traer = useCallback(async () => {
        try {
            const { data } = await api.get(BASE, SILENCIOSO);
            setPanel(data);
            setError(null);
        } catch (e) {
            setError(mensajeDe(e));
        }
    }, []);

    useEffect(() => {
        if (!activa) return undefined;
        traer();
        const t = setInterval(() => { if (!document.hidden) traer(); }, CADA_MS);
        return () => clearInterval(t);
    }, [activa, traer]);

    const cargarOpciones = useCallback(async () => {
        if (opciones || pidiendoOpciones.current) return;
        pidiendoOpciones.current = true;
        try {
            const { data } = await api.get(`${BASE}/opciones`, SILENCIOSO);
            setOpciones(data);
        } catch (e) {
            setError(mensajeDe(e));
        } finally {
            pidiendoOpciones.current = false;
        }
    }, [opciones]);

    /** Una acción; tira el error de Leadership (con su `error` y `mensaje`) para que la pantalla decida. */
    const pedir = useCallback(async (method, ruta, data) => {
        try {
            const res = await api.request({ method, url: BASE + ruta, data, ...SILENCIOSO });
            traer();
            return res.data;
        } catch (e) {
            const err = new Error(mensajeDe(e));
            err.datos = e?.response?.data || {};
            err.status = e?.response?.status;
            throw err;
        }
    }, [traer]);

    return { panel, opciones, error, traer, cargarOpciones, pedir };
}
