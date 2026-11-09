// Lo que el Triage Dashboard (diseño de Claude Design, 30/10/2026) calcula de `GET /api/triage/metricas`:
// los estados de las llamadas, el embudo con su cuello de botella y el estado de cada lead del reporte.

import { filtroDe } from '../../../triage/components/triageFiltros';

export const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
export const pctTexto = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

/** Llamadas con resultado (asistió o no show): la base del % de asistencia. Las sin reportar y las que aún no ocurren no cuentan. */
export const conResultado = (m) => m.asistencias + m.no_show;
/** Lo mismo con el closer: asistieron o no asistieron. Las pendientes de llamada no cuentan. */
export const closerConResultado = (m) => m.closer_asistieron + m.closer_no_asistieron;

/** Las seis etiquetas del estado de una llamada, con el color de su token (`var(--<color>)`). */
export const ESTADOS = [
    { clave: 'Califica', color: 'success' },
    { clave: 'No califica', color: 'warning' },
    { clave: 'No se presentó', color: 'error' },
    { clave: 'Canceló', color: 'brand-primary' },
    { clave: 'Sin reportar', color: 'idle' },
    { clave: 'Aún no ocurrió', color: 'info' },
];
export const COLOR_DE_ESTADO = Object.fromEntries(ESTADOS.map((e) => [e.clave, e.color]));

/** El estado de un lead del reporte; lo que no se reportó (también una reagenda) es «Sin reportar». */
export function estadoDe(lead) {
    if (lead.calificacion === 'calificado') return 'Califica';
    if (lead.calificacion === 'descalificado') return 'No califica';
    const asistencia = (lead.asistencia || '').trim().toLowerCase();
    if (asistencia === 'no show') return 'No se presentó';
    if (asistencia.startsWith('cancel')) return 'Canceló';
    // `ya_paso` false = la hora de la llamada todavía no llega; si el dato falta (caché vieja), se queda en «Sin reportar».
    return lead.ya_paso === false && !asistencia.startsWith('show') ? 'Aún no ocurrió' : 'Sin reportar';
}

/** Cuántas llamadas hay en cada estado (suman las agendas). «Aún no ocurrió» es la mitad futura de las sin resultado. */
export function estadosDe(m) {
    const n = { Califica: m.calificados, 'No califica': m.descalificados, 'No se presentó': m.no_show, Canceló: m.canceladas };
    n['Aún no ocurrió'] = m.por_ocurrir || 0;
    n['Sin reportar'] = Math.max(0, m.agendas - n.Califica - n['No califica'] - n['No se presentó'] - n.Canceló - n['Aún no ocurrió']);
    return ESTADOS.map((e) => ({ ...e, n: n[e.clave], pct: pct(n[e.clave], m.agendas) }));
}

/** Las etapas del embudo: las del triage (agendas → asistieron → calificados) y las de lo que pasó al closing.
 *  `cuello` es la etapa del triage que menos pasa de la anterior (la del closer no entra: es de otro equipo). */
export function embudoDe(m) {
    const etapas = [
        { clave: 'AGENDAS', n: m.agendas, color: 'brand-primary', filtro: 'agendas' },
        // Contra las llamadas con resultado: las que aún no ocurren o nadie reportó no son una caída del triage.
        { clave: 'ASISTIERON', n: m.asistencias, color: 'brand-secondary', de: conResultado(m), nota: `${m.asistencias} de ${conResultado(m)} con resultado`, filtro: 'asistencias', cuello: true },
        { clave: 'CALIFICADOS', n: m.calificados, color: 'success', de: m.asistencias, nota: `${m.calificados} de ${m.asistencias} asistieron`, filtro: 'calificados', cuello: true },
        // Los que pasaron a closing son los calificados: no se repiten como etapa, el grupo arranca en lo que hizo el closer.
        // Contra los que ya tuvieron la llamada (como la tarjeta): la que todavía no llega no es una caída.
        { clave: 'ASISTIERON AL CLOSER', rotulo: 'ASISTIERON', n: m.closer_asistieron, color: 'brand-secondary', de: closerConResultado(m), grupo: 'LO QUE PASÓ A CLOSING',
            nota: `${m.closer_asistieron} de ${closerConResultado(m)} con resultado${m.closer_por_venir ? ` · ${m.closer_por_venir} por venir` : ''}`, filtro: 'closer_asistieron' },
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

/** `por_dia` (un renglón por día y persona) en un renglón por día: de una persona o de todas. */
export const diasDe = (porDia = [], persona = null) => {
    const dias = new Map();
    porDia.filter((r) => persona == null || r.id === persona).forEach(({ dia, id, ...numeros }) => {
        const suma = dias.get(dia) || { dia };
        Object.entries(numeros).forEach(([k, v]) => { suma[k] = (suma[k] || 0) + v; });
        dias.set(dia, suma);
    });
    return [...dias.values()];
};

export const iniciales =(nombre) => (nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
