// Ocupación de los closers a partir de las reservas. Vive aparte del almacén para que la pantalla
// del lead la use sin arrastrar el almacén (ni la API de gestión) a la página pública.

import { seSolapa } from '../core/disponibilidad';

// Reservas vigentes (agendadas, con closer y horario) de una persona.
export function reservasDe(reservas, personaId) {
    return reservas.filter(r => r.estado === 'agendada' && r.closer_id === personaId && r.inicio_ms != null);
}
// Funciones que necesita asignacion(): si un closer ya tiene algo en ese rato, y cuántas agendas tiene por delante.
export function opcionesDeOcupacion(reservas, ahora = Date.now()) {
    const por = {};
    reservas.forEach(r => {
        if (r.estado !== 'agendada' || !r.closer_id || r.inicio_ms == null) return;
        // El margen que el closer se reservó después de la sesión también bloquea.
        const fin = r.fin_ms == null ? r.fin_ms : r.fin_ms + (r.margen_min || 0) * 60000;
        (por[r.closer_id] = por[r.closer_id] || []).push({ inicio: r.inicio_ms, fin });
    });
    return {
        ahora,
        ocupado: (pid, t, dur) => seSolapa(por[pid] || [], t, dur),
        cargaDe: (pid) => (por[pid] || []).filter(x => x.inicio >= ahora).length,
    };
}
