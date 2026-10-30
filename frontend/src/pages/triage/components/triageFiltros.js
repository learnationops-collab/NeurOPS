// Qué leads componen cada número de las métricas del triage: la lista que abre una tarjeta o una barra.
// Las claves son las de `embudo` y `lowTicket` (TriageMetricas.jsx); las cuentas salen del backend
// (triage_service._sumar) y los criterios de acá tienen que dar el mismo número.

const PITCHEADO = ['cerrado', 'no_cerrado', 'seguimiento', 'descartado'];
const asistencia = (l) => (l.asistencia || '').trim().toLowerCase();
const descalificado = (l) => l.calificacion === 'descalificado';
const lowTicketEs = (estado) => (l) => descalificado(l) && l.low_ticket === estado;

export const FILTROS = {
    agendas: { titulo: 'Agendas', coincide: () => true },
    confirmadas: { titulo: 'Confirmadas', coincide: (l) => !!l.confirmada },
    asistencias: { titulo: 'Asistieron', coincide: (l) => asistencia(l) === 'show up' },
    calificados: { titulo: 'Calificados', coincide: (l) => l.calificacion === 'calificado' },
    descalificados: { titulo: 'Descalificados', coincide: descalificado },
    pitch: { titulo: 'Presentaciones del low ticket', coincide: (l) => descalificado(l) && PITCHEADO.includes(l.low_ticket) },
    cerrado: { titulo: 'Cierres del low ticket', coincide: lowTicketEs('cerrado') },
    no_cerrado: { titulo: 'No cierres del low ticket', coincide: lowTicketEs('no_cerrado') },
    seguimiento: { titulo: 'Low ticket en seguimiento', coincide: lowTicketEs('seguimiento') },
    descartado: { titulo: 'Low ticket perdidos', coincide: lowTicketEs('descartado') },
};

export const filtrar = (leads, clave) => (FILTROS[clave] ? leads.filter(FILTROS[clave].coincide) : leads);
