// Las fases del setting (ADR-W184, estructura de setting de Mario, 20/11/2026): subdividen las tres etapas
// (Automática, Manual, Agendamiento). El servidor guarda solo el id (app/automatizaciones/fases.py). Lo que se
// manda en cada fase vive en la Guía del setting, editable desde el Inbox (`../guia/`, ADR-W197).

export const TRAMOS = {
    auto: { nombre: 'Automática', color: 'var(--info)' },
    manual: { nombre: 'Manual', color: '#7D63E6' },
    agenda: { nombre: 'Agendamiento', color: 'var(--warning)' },
    salida: { nombre: 'Sale del embudo', color: 'var(--error)' },
};

export const FASES = [
    { id: 'apertura', n: 1, tramo: 'auto', label: 'Apertura' },
    { id: 'conexion', n: 2, tramo: 'manual', label: 'Conexión y situación actual', corto: 'Conexión' },
    { id: 'dolor', n: 3, tramo: 'manual', label: 'Dolor' },
    { id: 'consecuencia', n: 4, tramo: 'manual', label: 'Consecuencia / urgencia', corto: 'Consecuencia' },
    { id: 'compromiso', n: 5, tramo: 'manual', label: 'Compromiso' },
    { id: 'propuesta', n: 6, tramo: 'manual', label: 'Propuesta de agenda', corto: 'Propuesta' },
    { id: 'link', n: 7, tramo: 'agenda', label: 'Link' },
    { id: 'confirmacion', n: 8, tramo: 'agenda', label: 'Confirmación' },
    { id: 'nolead', n: '×', tramo: 'salida', label: 'No lead (descalificado)', corto: 'No lead' },
    { id: 'inabrible', n: '–', tramo: 'salida', label: 'In-abrible' },
];

const EMBUDO = FASES.filter((f) => f.tramo !== 'salida').map((f) => f.id);

export const faseDe = (id) => FASES.find((f) => f.id === id) || FASES[0];
export const corto = (f) => f.corto || f.label;
export const colorDe = (f) => TRAMOS[f.tramo].color;
export const ordenDe = (id) => EMBUDO.indexOf(id);
/** La que sigue en el embudo, o null en la última y en las salidas. */
export const siguiente = (id) => { const i = EMBUDO.indexOf(id); return i >= 0 && i < EMBUDO.length - 1 ? faseDe(EMBUDO[i + 1]) : null; };
