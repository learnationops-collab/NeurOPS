// Qué leads componen cada número de las métricas del triage: la lista que abre una tarjeta o una barra.
// Las claves son las de los paneles del tablero (TriagePaneles.jsx); las cuentas salen del backend
// (triage_service._sumar) y los criterios de acá tienen que dar el mismo número.
// Lo que pasó al closing sale de `lead.closing` (triage_pases.py): el pase del lead, o null.

const PITCHEADO = ['cerrado', 'no_cerrado', 'seguimiento', 'descartado'];
const asistencia = (l) => (l.asistencia || '').trim().toLowerCase();
const descalificado = (l) => l.calificacion === 'descalificado';
const lowTicketEs = (estado) => (l) => descalificado(l) && l.low_ticket === estado;

export const FILTROS = {
    agendas: { titulo: 'Agendas', coincide: () => true },
    asistencias: { titulo: 'Asistieron', coincide: (l) => asistencia(l) === 'show up' },
    // La base del % de asistencia: llamadas que ya tienen resultado (asistió o no show).
    con_resultado: { titulo: 'Llamadas con resultado', coincide: (l) => ['show up', 'no show'].includes(asistencia(l)) },
    sin_reporte: { titulo: 'Sin reportar (ya pasaron)', coincide: (l) => ['', 'pendiente'].includes(asistencia(l)) && !!l.ya_paso },
    por_ocurrir: { titulo: 'Aún no ocurrieron', coincide: (l) => ['', 'pendiente'].includes(asistencia(l)) && !l.ya_paso },
    calificados: { titulo: 'Calificados', coincide: (l) => l.calificacion === 'calificado' },
    pasaron: { titulo: 'Pasaron a closing', coincide: (l) => !!l.closing },
    closer_asistieron: { titulo: 'Asistieron al closer', coincide: (l) => !!l.closing?.asistio },
    closer_cerraron: { titulo: 'Cerraron con el closer', coincide: (l) => !!l.closing?.cerro },
    closer_no_asistieron: { titulo: 'No asistieron al closer', coincide: (l) => l.closing?.estado === 'no_asistio' },
    closer_pendientes: { titulo: 'Pendientes de llamada con el closer', coincide: (l) => ['pendiente', 'sin_reporte'].includes(l.closing?.estado) },
    closer_sin_reporte: { titulo: 'Con el closer: ya pasaron sin reporte', coincide: (l) => l.closing?.estado === 'sin_reporte' },
    closer_por_venir: { titulo: 'Con el closer: todavía no llegan', coincide: (l) => l.closing?.estado === 'pendiente' },
    closer_senas: { titulo: 'Señas con el closer', coincide: (l) => !!l.closing?.sena },
    descalificados: { titulo: 'Descalificados', coincide: descalificado },
    pitch: { titulo: 'Presentaciones del low ticket', coincide: (l) => descalificado(l) && PITCHEADO.includes(l.low_ticket) },
    cerrado: { titulo: 'Cierres del low ticket', coincide: lowTicketEs('cerrado') },
    no_cerrado: { titulo: 'No cierres del low ticket', coincide: lowTicketEs('no_cerrado') },
    seguimiento: { titulo: 'Low ticket en seguimiento', coincide: lowTicketEs('seguimiento') },
    descartado: { titulo: 'Low ticket perdidos', coincide: lowTicketEs('descartado') },
};

// `cl:<id del closer>:<pasaron|asistieron|cerraron>`: la misma lista acotada a un closer (tabla «Por closer»).
const DEL_CLOSER = { pasaron: 'pasaron', asistieron: 'closer_asistieron', cerraron: 'closer_cerraron', senas: 'closer_senas' };

/** El filtro de una clave (`{ titulo, coincide }`) o null. `nombreCloser` pone su nombre en el título de `cl:`. */
export function filtroDe(clave, nombreCloser = null) {
    const c = /^cl:(\d+):(pasaron|asistieron|cerraron|senas)$/.exec(clave || '');
    if (!c) return FILTROS[clave] || null;
    const base = FILTROS[DEL_CLOSER[c[2]]];
    return {
        titulo: nombreCloser ? `${base.titulo} · ${nombreCloser}` : base.titulo,
        coincide: (l) => l.closing?.closer_id === Number(c[1]) && base.coincide(l),
    };
}

export const filtrar = (leads, clave) => (filtroDe(clave) ? leads.filter(filtroDe(clave).coincide) : leads);
