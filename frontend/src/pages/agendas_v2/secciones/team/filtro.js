// El Filtro completo de Available: el mismo panel multicategoría de Closing (PanelConfigurar), con las
// facetas de cada tarjeta del calendario. Las de la agenda (estado, pre call, post call, fuente, setter,
// confirmada, asistió, presentó) salen de su ficha de Closing (GET /agendas-v2/fichas) con las mismas
// funciones que la tabla de Agendas, así un filtro da lo mismo en los dos lados. Sin React, para probarlo.

import { asistio, estadoDeAgenda, fueConfirmada, presento } from '../../../comercial/components/tablasDef';
import { VISUAL } from './tarjetas';

// Lo que le pasó a una agenda en Google Calendar, en palabras.
export const EN_CALENDAR = {
    vigente: 'En Calendar', rechazada: 'Rechazada por el lead', sin_evento: 'Ya no está en Calendar', cancelada: 'Cancelada',
};
export function enCalendar(r) {
    if (r.motivo === 'sin_evento') return EN_CALENDAR.sin_evento;
    if (r.motivo) return EN_CALENDAR.cancelada;
    return r.calendar && r.calendar.estado === 'rechazado' ? EN_CALENDAR.rechazada : EN_CALENDAR.vigente;
}

// La ficha de Closing de una agenda: la de n8n viaja como 'n8n-<id>'.
export const fichaDe = (fichas, r) => (fichas && r && r.id != null ? fichas[String(r.id).replace(/^n8n-/, '')] || null : null);

// Una faceta que solo tiene valor en las agendas (las demás tarjetas no la cumplen).
const deAgenda = (fn) => (z) => (z.reserva ? fn(z) || null : null);
const deFicha = (fn) => (z) => (z.reserva && z.ficha ? fn(z.ficha) || null : null);

export const FACETAS = [
    { key: 'tipo', label: 'Tipo', de: (z) => (VISUAL[z.tipo] ? VISUAL[z.tipo].n : null) },
    { key: 'closer', label: 'Closer', de: (z) => (z.p ? z.p.nombre : null) },
    { key: 'calendar', label: 'Calendar', de: deAgenda((z) => enCalendar(z.reserva)) },
    { key: 'estado', label: 'Estado', de: deFicha(estadoDeAgenda) },
    { key: 'pre_call', label: 'Pre call', de: deFicha((f) => f.pre_call && f.pre_call.label) },
    { key: 'post_call', label: 'Post call', de: deFicha((f) => f.post_call && f.post_call.label) },
    { key: 'fuente', label: 'Fuente', de: deFicha((f) => f.fuente) },
    { key: 'setter', label: 'Setter', de: deFicha((f) => f.setter || 'Sin setter') },
    { key: 'funnel', label: 'Funnel', de: deAgenda((z) => z.funnel || 'Sin funnel') },
    { key: 'confirmada', label: 'Confirmada', de: deFicha(fueConfirmada) },
    { key: 'asistio', label: 'Asistió', de: deFicha(asistio) },
    { key: 'presento', label: 'Presentó', de: deFicha(presento) },
];

// Cuántos valores hay puestos en total.
export const condiciones = (facetas) => FACETAS.reduce((a, fa) => a + ((facetas[fa.key] || []).length), 0);

// Las tarjetas que cumplen las facetas puestas: todas o alguna (`modo`), como en Revisar.
export function aplicarFacetas(piezas, facetas, modo = 'todas') {
    const activas = FACETAS.filter(fa => (facetas[fa.key] || []).length > 0);
    if (!activas.length) return piezas;
    return piezas.filter(z => {
        const cumple = activas.map(fa => facetas[fa.key].includes(fa.de(z)));
        return modo === 'alguna' ? cumple.some(Boolean) : cumple.every(Boolean);
    });
}

// Cuántas agendas distintas hay entre esas tarjetas (una agenda que cruza dos franjas es una sola).
export const agendasDe = (piezas) => new Set(piezas.filter(z => z.src === 'ag').map(z => z.reserva.id ?? z.a + '-' + z.p.id)).size;
