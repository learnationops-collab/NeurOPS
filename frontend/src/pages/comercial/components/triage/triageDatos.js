// Lo que el Triage Dashboard (diseño de Claude Design, 30/10/2026) calcula de `GET /api/triage/metricas`:
// los estados de las llamadas, el embudo con su cuello de botella y el estado de cada lead del reporte.

import { MOTIVOS, SIN_MOTIVO } from '../../../../utils/motivosTriage';
import { destinoDe, filtroDe } from '../../../triage/components/triageFiltros';

export const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
export const pctTexto = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

/** El cierre del low ticket por cobro (ADR-W189): cada venta cobrada es un cierre; la de una llamada anterior suma
 *  arriba y abajo. Sin los campos nuevos (`lt_*`) cae en el estado de las llamadas del período. */
export const cierreLowTicket = (m) => (m.lt_base == null
    ? { cierres: m.cerrado, base: m.pitch_low_ticket, anteriores: 0, cobrado: 0, ventas: 0, neto: 0 }
    : { cierres: m.lt_cierres, base: m.lt_base, anteriores: m.lt_anteriores, cobrado: m.lt_cobrado, ventas: m.lt_ventas, neto: m.lt_neto });

/** La base del % de asistencia, la misma de closing (ADR-W145): los cuatro destinos (se presentó, no show, canceló,
 *  reprogramó) y las ya pasadas sin reportar. Lo que aún no ocurre y los otros estados no cuentan. */
export const conResultado = (m) => m.asistencias + m.no_show + m.canceladas + (m.reagendadas || 0) + m.sin_reporte;
/** Lo mismo con el closer: asistieron o no asistieron. Las pendientes de llamada no cuentan. */
export const closerConResultado = (m) => m.closer_asistieron + m.closer_no_asistieron;

/** Los destinos de la tarjeta «Estados»: reparten la base del % de asistencia y cada uno abre su lista (`filtro`). */
const DESTINOS = [
    { clave: 'Se presentó', campo: 'asistencias', color: 'success', filtro: 'asistencias' },
    { clave: 'No show', campo: 'no_show', color: 'error', filtro: 'no_show' },
    { clave: 'Canceló', campo: 'canceladas', color: 'brand-primary', filtro: 'canceladas' },
    { clave: 'Reprogramó', campo: 'reagendadas', color: 'info', filtro: 'reagendadas' },
    { clave: 'Sin reportar', campo: 'sin_reporte', color: 'idle', filtro: 'sin_reporte' },
];
export const destinosDe = (m) => DESTINOS.map((d) => ({ ...d, n: m[d.campo] || 0, pct: pct(m[d.campo] || 0, conResultado(m)) }));

/** Lo que no cuenta en la base: la llamada que todavía no llega y la que quedó en un estado que no es un destino. */
export const fueraDe = (m) => [[m.por_ocurrir || 0, 'aún no ocurren', 'por_ocurrir'], [m.fuera || 0, 'otros', 'fuera']];

/** De los que se presentaron, cómo quedó la calificación: las cuatro cuentas suman las asistencias. */
export const calificacionDe = (m) => [
    { clave: 'calificados', n: m.calificados, color: 'success', filtro: 'calificados' },
    { clave: 'no califican', n: m.descalificados, color: 'warning', filtro: 'descalificados' },
    { clave: 'lo van a pensar', n: m.en_seguimiento || 0, color: 'info', filtro: 'en_seguimiento' },
    { clave: 'sin calificar', n: m.sin_calificar ?? Math.max(0, m.asistencias - m.calificados - m.descalificados - (m.en_seguimiento || 0)), color: 'idle', filtro: 'sin_calificar' },
];

/** Las etiquetas del estado de un lead en el reporte, con el color de su token (`var(--<color>)`). Las que son
 *  `soloSiHay` no muestran su chip en cero. */
export const ESTADOS = [
    { clave: 'Califica', color: 'success' },
    { clave: 'No califica', color: 'warning' },
    { clave: 'Lo va a pensar', color: 'info' },
    { clave: 'Sin calificar', color: 'idle', soloSiHay: true },
    { clave: 'No se presentó', color: 'error' },
    { clave: 'Canceló', color: 'brand-primary' },
    { clave: 'Reprogramó', color: 'info', soloSiHay: true },
    { clave: 'Sin reportar', color: 'idle' },
    { clave: 'Aún no ocurrió', color: 'info' },
    { clave: 'Otro estado', color: 'idle', soloSiHay: true },
];
export const COLOR_DE_ESTADO = Object.fromEntries(ESTADOS.map((e) => [e.clave, e.color]));
const ESTADO_DEL_DESTINO = { asistio: 'Sin calificar', no_show: 'No se presentó', cancelo: 'Canceló', reagendo: 'Reprogramó',
    sin_reporte: 'Sin reportar', por_ocurrir: 'Aún no ocurrió', fuera: 'Otro estado' };

/** El estado de un lead del reporte: su calificación si la tiene y, si no, el destino de la llamada. */
export function estadoDe(lead) {
    if (lead.calificacion === 'calificado') return 'Califica';
    if (lead.calificacion === 'descalificado') return 'No califica';
    if (lead.calificacion === 'seguimiento') return 'Lo va a pensar';
    return ESTADO_DEL_DESTINO[destinoDe(lead)];
}

const partes = (...p) => p.filter(Boolean).join(' · ');

/** Las seis etapas del embudo, cada una con su cuenta «n de d»: las del triage (agendas → asistieron → cualificadas)
 *  y lo que pasó a closing (pasaron → asistieron → cerraron).
 *  `cuello` es la etapa del triage que menos pasa de la anterior (la del closer no entra: es de otro equipo). */
export function embudoDe(m) {
    const base = conResultado(m);
    const [, , piensan, sinCalificar] = calificacionDe(m).map((c) => c.n);
    const etapas = [
        { clave: 'AGENDAS', n: m.agendas, color: 'brand-primary', filtro: 'agendas' },
        // Contra las agendas con destino: la que aún no ocurre no es una caída del triage.
        { clave: 'ASISTIERON', n: m.asistencias, color: 'brand-secondary', de: base, nota: `${m.asistencias} de ${base} con destino`, filtro: 'asistencias', cuello: true },
        { clave: 'CUALIFICADAS', n: m.calificados, color: 'success', de: m.asistencias, filtro: 'calificados', cuello: true,
            nota: partes(`${m.calificados} de ${m.asistencias} asistieron`, m.descalificados && `${m.descalificados} no califican`,
                piensan && `${piensan} lo piensan`, sinCalificar && `${sinCalificar} sin calificar`) },
        { clave: 'PASARON A CLOSING', rotulo: 'PASARON', n: m.pasaron, color: 'info', de: m.calificados, grupo: 'LO QUE PASÓ A CLOSING',
            nota: `${m.pasaron} de ${m.calificados} cualificadas`, filtro: 'pasaron' },
        // Contra los que ya tuvieron la llamada (como la tarjeta): la que todavía no llega no es una caída.
        { clave: 'ASISTIERON AL CLOSER', rotulo: 'ASISTIERON', n: m.closer_asistieron, color: 'brand-secondary', de: closerConResultado(m), filtro: 'closer_asistieron',
            nota: partes(`${m.closer_asistieron} de ${closerConResultado(m)} con resultado`, m.closer_por_venir && `${m.closer_por_venir} por venir`,
                m.closer_sin_reporte && `${m.closer_sin_reporte} sin reportar`) },
        { clave: 'CERRARON', rotulo: 'CERRARON', n: m.closer_cerraron, color: 'success', de: m.closer_asistieron, filtro: 'closer_cerraron',
            nota: partes(`${m.closer_cerraron} de ${m.closer_asistieron} asistieron`, m.closer_senas && `${m.closer_senas} ${m.closer_senas === 1 ? 'seña' : 'señas'}`) },
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

/** Por qué no pasaron a closing los que no califican (ADR-W153): una fila por motivo, de mayor a menor, con su
 *  parte del total. «Sin motivo» (reportadas antes del cambio) va al final y solo si hay alguna. */
export function motivosDe(m) {
    const fila = (x) => ({ clave: x.valor, texto: x.corto, n: m[`motivo_${x.valor}`] || 0, filtro: `motivo_${x.valor}` });
    const sinMotivo = fila(SIN_MOTIVO);
    const filas = [...MOTIVOS.map(fila).sort((a, b) => b.n - a.n), ...(sinMotivo.n ? [sinMotivo] : [])];
    return filas.map((f) => ({ ...f, pct: pct(f.n, m.descalificados) }));
}
