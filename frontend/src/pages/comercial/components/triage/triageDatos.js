// Lo que el Triage Dashboard (diseño de Claude Design, 30/10/2026) calcula de `GET /api/triage/metricas`:
// los estados de las llamadas, el embudo con su cuello de botella y el estado de cada lead del reporte.

import { filtroDe } from '../../../triage/components/triageFiltros';

export const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
export const pctTexto = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

/** Las cinco etiquetas del estado de una llamada, con el color de su token (`var(--<color>)`). */
export const ESTADOS = [
    { clave: 'Califica', color: 'success' },
    { clave: 'No califica', color: 'warning' },
    { clave: 'No se presentó', color: 'error' },
    { clave: 'Canceló', color: 'brand-primary' },
    { clave: 'Sin reportar', color: 'idle' },
];
export const COLOR_DE_ESTADO = Object.fromEntries(ESTADOS.map((e) => [e.clave, e.color]));

/** El estado de un lead del reporte; lo que no se reportó (también una reagenda) es «Sin reportar». */
export function estadoDe(lead) {
    if (lead.calificacion === 'calificado') return 'Califica';
    if (lead.calificacion === 'descalificado') return 'No califica';
    const asistencia = (lead.asistencia || '').trim().toLowerCase();
    if (asistencia === 'no show') return 'No se presentó';
    if (asistencia.startsWith('cancel')) return 'Canceló';
    return 'Sin reportar';
}

/** Cuántas llamadas hay en cada estado (suman las agendas). */
export function estadosDe(m) {
    const n = { Califica: m.calificados, 'No califica': m.descalificados, 'No se presentó': m.no_show, Canceló: m.canceladas };
    n['Sin reportar'] = Math.max(0, m.agendas - n.Califica - n['No califica'] - n['No se presentó'] - n.Canceló);
    return ESTADOS.map((e) => ({ ...e, n: n[e.clave], pct: pct(n[e.clave], m.agendas) }));
}

/** Las etapas del embudo: las del triage (agendas → asistieron → calificados) y las de lo que pasó al closing.
 *  `cuello` es la etapa del triage que menos pasa de la anterior (la del closer no entra: es de otro equipo). */
export function embudoDe(m) {
    const etapas = [
        { clave: 'AGENDAS', n: m.agendas, color: 'brand-primary', filtro: 'agendas' },
        { clave: 'ASISTIERON', n: m.asistencias, color: 'brand-secondary', de: m.agendas, nota: `${m.asistencias} de ${m.agendas} agendas`, filtro: 'asistencias', cuello: true },
        { clave: 'CALIFICADOS', n: m.calificados, color: 'success', de: m.asistencias, nota: `${m.calificados} de ${m.asistencias} asistieron`, filtro: 'calificados', cuello: true },
        { clave: 'PASARON', rotulo: 'PASARON', n: m.pasaron, color: 'info', grupo: 'LO QUE PASÓ A CLOSING', filtro: 'pasaron', nota: `${m.pasaron} de ${m.calificados} calificados` },
        { clave: 'ASISTIERON AL CLOSER', rotulo: 'ASISTIERON', n: m.closer_asistieron, color: 'brand-secondary', de: m.pasaron, nota: `${m.closer_asistieron} de ${m.pasaron} pasaron`, filtro: 'closer_asistieron' },
        { clave: 'CERRARON', rotulo: 'CERRARON', n: m.closer_cerraron, color: 'success', de: m.closer_asistieron, nota: `${m.closer_cerraron} de ${m.closer_asistieron} asistieron`, filtro: 'closer_cerraron' },
    ];
    const conPaso = etapas.filter((e) => e.de && e.cuello);
    const cuello = conPaso.length ? conPaso.reduce((peor, e) => (pct(e.n, e.de) < pct(peor.n, peor.de) ? e : peor)) : null;
    return { etapas, cuello: cuello?.clave || null };
}

/** ¿El lead entra en este filtro? `st:<estado>` es un chip del reporte; el resto, una cuenta (triageFiltros.js). */
export function coincide(lead, ver) {
    if (!ver || ver === 'agendas') return true;
    if (ver.startsWith('st:')) return estadoDe(lead) === ver.slice(3);
    return filtroDe(ver) ? filtroDe(ver).coincide(lead) : true;
}

export const iniciales = (nombre) => (nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
