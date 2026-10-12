// Lo que comparten las vistas de la semana (Available y los turnos): la hora actual y lo ocupado en el
// Google Calendar de cada persona.

import { useEffect, useState } from 'react';
import { almacen, useDatos } from '../../data/hooks';

// La zona en la que mira la semana del equipo quien está usando Thalamus: la del país de su WhatsApp (la
// manda el servidor) o, si no tiene, la de su navegador. Así coincide con su propio Google Calendar.
export function useZonaVista() {
    const { zona } = useDatos();
    if (zona) return zona;
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
}

// Hora actual, que se renueva cada minuto.
export function useAhora() {
    const [ahora, setAhora] = useState(() => Date.now());
    useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 60000); return () => clearInterval(t); }, []);
    return ahora;
}

// Lo ocupado en Google de cada persona entre desde y hasta, renovado cada 2 minutos (lo que el servidor
// guarda lo leído). null mientras no llega o sin API; 'error' si el pedido entero falló.
export function useOcupacionGoogle(desde, hasta, activo) {
    const [res, setRes] = useState(null);   // {k, datos}
    const k = desde + '-' + hasta;
    useEffect(() => {
        const ad = almacen.adaptador;
        if (!activo || !ad.ocupacion) return undefined;
        let vivo = true;
        const pedir = () => ad.ocupacion(desde, hasta).then(
            (datos) => { if (vivo) setRes({ k, datos }); },
            // Si falla una renovación se queda lo último leído de esta semana.
            () => { if (vivo) setRes(r => (r && r.k === k ? r : { k, datos: 'error' })); },
        );
        pedir();
        const t = setInterval(pedir, 120000);
        return () => { vivo = false; clearInterval(t); };
    }, [k, activo]); // eslint-disable-line react-hooks/exhaustive-deps
    return res && res.k === k ? res.datos : null;
}

const SIN_LEER = { estado: 'error', franjas: [] };

// googleDe(personaId) a partir de lo que devolvió useOcupacionGoogle.
export function googleDeOcupacion(google) {
    if (google === 'error') return () => SIN_LEER;
    return google ? (id) => google[id] || null : () => null;
}
