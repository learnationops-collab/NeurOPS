import { abrir } from '../../../components/dashboard/MetricaClicable';
import { destinoDeCanal } from './destinos';

/**
 * El embudo de Closing partido en agendas directas y agendas desde triage (02/11/2026). El backend manda
 * `por_canal` en cada paso (`{ directa, triage }`, suman el total del paso); acá se vuelve lo que `Embudo` dibuja.
 */

// El orden es el de `partes` y el de `canales` del Embudo: la primera parte va a la izquierda.
export const CANALES = [
    { clave: 'directa', nombre: 'Directas', color: 'var(--info)' },
    { clave: 'triage', nombre: 'Desde triage', color: 'var(--brand-secondary)' },
];

/** Las dos partes de un paso y la lista que abre cada una. Vacío si el bloque no trae el corte (un payload viejo). */
export const partesDe = (porCanal, destino, irA) => (porCanal ? {
    partes: CANALES.map(c => porCanal[c.clave] || 0),
    irPartes: CANALES.map(c => abrir(irA, destinoDeCanal(destino, c.clave))),
} : {});

/** La leyenda del embudo: cada canal con las agendas del primer paso. null sin corte por canal. */
export const canalesDe = (funnel, destinoAgendas, irA) => {
    const total = funnel?.[0]?.por_canal;
    if (!total) return null;
    return CANALES.map(c => ({
        nombre: c.nombre, color: c.color, n: total[c.clave] || 0,
        ir: abrir(irA, destinoDeCanal(destinoAgendas, c.clave)),
    }));
};
