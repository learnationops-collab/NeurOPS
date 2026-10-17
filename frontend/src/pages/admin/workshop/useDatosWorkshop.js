import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';

/**
 * Los tres pedidos que comparten las pestañas de Workshop: talleres, metas y plan de acciones.
 *
 * Salen juntos y cada uno llena SU estado apenas llega: `null` mientras no llegó, así cada bloque
 * de la pantalla muestra su esqueleto hasta tener su dato (antes un solo `loading` de los talleres
 * tapaba todo y las metas aparecían después, moviendo la pantalla).
 *
 * Recargar no vuelve a `null`: lo que ya se ve queda a la vista hasta que llega lo nuevo
 * (`recargando` es para el ícono del botón). Si la PRIMERA carga de algo falla, `fallas[clave]`
 * queda en true para que su bloque ofrezca reintentar en vez de un esqueleto eterno.
 *
 * El polling silencioso cada 20 s trae los talleres que el backend ya sincronizó solo
 * (workshop_live_sync.py) sin que haya que recargar.
 */

const RUTAS = { events: 'workshop/events', goals: 'workshop/goals', actions: 'workshop/actions' };
const MENSAJE = {
    events: 'Error al cargar los talleres',
    goals: 'No se pudieron cargar las metas',
    actions: 'No se pudo cargar el plan de acciones',
};
const POLLING_MS = 20000;

export default function useDatosWorkshop() {
    const [datos, setDatos] = useState({ events: null, goals: null, actions: null });
    const [fallas, setFallas] = useState({});
    const [recargando, setRecargando] = useState(false);
    const vivo = useRef(true);
    useEffect(() => {
        vivo.current = true;
        return () => { vivo.current = false; };
    }, []);

    // `silent`: el polling y los guardados parciales; no avisan si falla un tick.
    const pedir = useCallback(async (clave, silent = false) => {
        try {
            const { data } = await api.get(RUTAS[clave]);
            if (!vivo.current) return;
            if (clave === 'events' && !Array.isArray(data)) return;
            setDatos((d) => ({ ...d, [clave]: data }));
            setFallas((f) => (f[clave] ? { ...f, [clave]: false } : f));
        } catch (err) {
            console.error(`Error cargando ${RUTAS[clave]}:`, err);
            if (!vivo.current) return;
            setFallas((f) => ({ ...f, [clave]: true }));
            if (!silent) toast.error(MENSAJE[clave]);
        }
    }, []);

    const fetchEvents = useCallback((silent = false) => pedir('events', silent), [pedir]);
    const fetchGoals = useCallback(() => pedir('goals'), [pedir]);
    const fetchActions = useCallback(() => pedir('actions'), [pedir]);

    const recargar = useCallback(async () => {
        setRecargando(true);
        await Promise.all(Object.keys(RUTAS).map((clave) => pedir(clave)));
        if (vivo.current) setRecargando(false);
    }, [pedir]);

    useEffect(() => {
        Object.keys(RUTAS).forEach((clave) => pedir(clave, false));
        const intervalo = setInterval(() => pedir('events', true), POLLING_MS);
        return () => clearInterval(intervalo);
    }, [pedir]);

    const setGoals = useCallback((goals) => setDatos((d) => ({ ...d, goals })), []);

    return { ...datos, fallas, recargando, recargar, fetchEvents, fetchGoals, fetchActions, setGoals };
}
