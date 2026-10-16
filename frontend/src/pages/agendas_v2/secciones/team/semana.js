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

// La ficha de Closing de cada agenda de la semana ({appointment_id: ficha}), para el Filtro completo. {}
// mientras no llega, sin API o si falla: el calendario se ve igual, solo no se filtra por lo de Closing.
export function useFichas(desde, hasta, activo) {
    const [res, setRes] = useState(null);   // {k, fichas}
    const k = desde + '-' + hasta;
    useEffect(() => {
        const ad = almacen.adaptador;
        if (!activo || !ad.fichas) return undefined;
        let vivo = true;
        const pedir = () => ad.fichas(desde, hasta).then((fichas) => { if (vivo) setRes({ k, fichas }); }, () => {});
        pedir();
        const t = setInterval(pedir, 120000);
        return () => { vivo = false; clearInterval(t); };
    }, [k, activo]); // eslint-disable-line react-hooks/exhaustive-deps
    return res && res.k === k ? res.fichas : SIN_FICHAS;
}
const SIN_FICHAS = {};

const SIN_LEER = { estado: 'error', franjas: [] };

// googleDe(personaId) a partir de lo que devolvió useOcupacionGoogle.
export function googleDeOcupacion(google) {
    if (google === 'error') return () => SIN_LEER;
    return google ? (id) => google[id] || null : () => null;
}

// Una agenda de n8n (de /ocupacion) con la forma de una reserva.
const deN8n = (a) => ({
    id: 'n8n-' + a.id, inicio_ms: a.inicio, fin_ms: a.fin, margen_min: 0, lead: { nombre: a.nombre }, n8n: true, resultado: a.resultado, calendar: a.calendar || null,
});
// Lo que le pasó al evento de una agenda que deja libre su horario (la traza de /ocupacion).
export const NO_OCUPA = ['cancelado', 'borrado', 'movido', 'disponible'];

// Una agenda recién tomada puede no estar todavía en lo leído de Google: hasta 10 minutos, ocupa igual.
const GRACIA_MS = 10 * 60000;

/**
 * Las agendas de cada persona en la semana, de los dos sistemas. Google Calendar manda: con su
 * calendario leído, una reserva que ya no está ahí (cancelada, borrada o marcada «Disponible») no ocupa.
 * Si su evento está vinculado (la traza, en `calendar`), se sabe por él; si no, por la hora.
 * ocupan(id): las reservas de Agendas 2.0 agendadas o ya hechas (procesadas) y las de n8n vigentes.
 * canceladas(id): las que ya no ocupan, cada una con `motivo`: 'cancelada' (cancelada o reprogramada)
 * o 'sin_evento' (vigente en NeurOPS pero ya no está en su Google Calendar).
 */
export function agendasDeVista(reservas, google, ahora = Date.now()) {
    const g = googleDeOcupacion(google);
    const n8n = (id) => ((g(id) || {}).agendas || []);
    const traza = (id, r) => (((g(id) || {}).trazas || {})[r.id]) || null;
    const enGoogle = (id, r) => {
        const x = g(id);
        if (!x || x.estado !== 'ok' || (r.creada && Date.parse(r.creada) > ahora - GRACIA_MS)) return true;
        const t = r.calendar;
        if (t && t.estado !== 'sin_vincular' && t.estado !== 'sin_dato') return !NO_OCUPA.includes(t.estado);
        return (x.franjas || []).some(([a, b]) => a <= r.inicio_ms && r.inicio_ms < b);
    };
    const propias = (id) => reservas.filter(r => r.closer_id === id && r.inicio_ms != null).map(r => ({ ...r, calendar: traza(id, r) }));
    const vigentes = (id) => propias(id).filter(r => r.estado === 'agendada' || r.cancelada === false);
    return {
        ocupan: (id) => vigentes(id).filter(r => enGoogle(id, r))
            .concat(n8n(id).filter(a => a.estado === 'vigente').map(deN8n)),
        canceladas: (id) => propias(id).filter(r => r.estado !== 'agendada' && r.cancelada !== false).map(r => ({ ...r, motivo: 'cancelada' }))
            .concat(vigentes(id).filter(r => !enGoogle(id, r)).map(r => ({ ...r, motivo: 'sin_evento' })))
            .concat(n8n(id).filter(a => a.estado !== 'vigente').map(a => ({ ...deN8n(a), motivo: a.estado }))),
    };
}
