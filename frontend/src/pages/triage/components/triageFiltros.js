// Qué leads componen cada número de las métricas del triage: la lista que abre una tarjeta o una barra.
// Las claves son las de los paneles del tablero (TriagePaneles.jsx); las cuentas salen del backend
// (triage_service._sumar) y los criterios de acá tienen que dar el mismo número.
// Lo que pasó al closing sale de `lead.closing` (triage_pases.py): el pase del lead, o null.

import { MOTIVOS, SIN_MOTIVO, claveDeMotivo } from '../../../utils/motivosTriage';

const PITCHEADO = ['cerrado', 'no_cerrado', 'seguimiento', 'descartado'];
const REAGENDA = ['reagend', 'reprogram'];
const asistencia = (l) => (l.asistencia || '').trim().toLowerCase();
const descalificado = (l) => l.calificacion === 'descalificado';
const lowTicketEs = (estado) => (l) => descalificado(l) && l.low_ticket === estado;

/** El destino de la llamada, el mismo que cuenta el servidor (`triage_filas.destino_de`, ADR-W145). Sin el dato
 *  (una respuesta guardada de antes) se deduce de la asistencia. */
export function destinoDe(l) {
    if (l.destino) return l.destino;
    const a = asistencia(l);
    if (a === 'show up') return 'asistio';
    if (a === 'no show') return 'no_show';
    if (a.startsWith('cancel')) return 'cancelo';
    if (REAGENDA.some((p) => a.startsWith(p))) return 'reagendo';
    if (['', 'pendiente'].includes(a)) return l.ya_paso ? 'sin_reporte' : 'por_ocurrir';
    return 'fuera';
}
const destinoEs = (...destinos) => (l) => destinos.includes(destinoDe(l));

export const FILTROS = {
    agendas: { titulo: 'Agendas', coincide: () => true },
    asistencias: { titulo: 'Asistieron', coincide: destinoEs('asistio') },
    no_show: { titulo: 'No se presentaron', coincide: destinoEs('no_show') },
    canceladas: { titulo: 'Cancelaron', coincide: destinoEs('cancelo') },
    reagendadas: { titulo: 'Reprogramaron', coincide: destinoEs('reagendo') },
    sin_reporte: { titulo: 'Sin reportar (ya pasaron)', coincide: destinoEs('sin_reporte') },
    // La base del % de asistencia, la misma de closing: los cuatro destinos y las ya pasadas sin reportar.
    base: { titulo: 'Agendas con destino', coincide: destinoEs('asistio', 'no_show', 'cancelo', 'reagendo', 'sin_reporte') },
    por_ocurrir: { titulo: 'Aún no ocurrieron', coincide: destinoEs('por_ocurrir') },
    // Descalificada, lead perdido o archivada: un estado que no es un destino y no entra en la base.
    fuera: { titulo: 'Otros estados (no cuentan en la asistencia)', coincide: destinoEs('fuera') },
    con_resultado: { titulo: 'Llamadas con resultado', coincide: (l) => ['show up', 'no show'].includes(asistencia(l)) },
    sin_calificar: { titulo: 'Asistieron y falta la calificación', coincide: (l) => destinoDe(l) === 'asistio' && !l.calificacion },
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
    en_seguimiento: { titulo: 'Lo van a pensar', coincide: (l) => l.calificacion === 'seguimiento' },
    pitch: { titulo: 'Presentaciones del low ticket', coincide: (l) => descalificado(l) && PITCHEADO.includes(l.low_ticket) },
    cerrado: { titulo: 'Cierres del low ticket', coincide: lowTicketEs('cerrado') },
    no_cerrado: { titulo: 'No cierres del low ticket', coincide: lowTicketEs('no_cerrado') },
    seguimiento: { titulo: 'Low ticket en seguimiento', coincide: lowTicketEs('seguimiento') },
    descartado: { titulo: 'Low ticket perdidos', coincide: lowTicketEs('descartado') },
    // Por qué no pasó a closing cada descalificada (ADR-W151): `motivo_<clave>`, la misma clave que cuenta el servidor.
    ...Object.fromEntries([...MOTIVOS, SIN_MOTIVO].map((m) => [`motivo_${m.valor}`,
        { titulo: `No pasaron a closing · ${m.corto}`, coincide: (l) => descalificado(l) && claveDeMotivo(l) === m.valor }])),
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
