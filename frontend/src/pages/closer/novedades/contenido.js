// Novedades del Workspace de closers y triage (ADR-W218). Para anunciar una tanda nueva se cambia
// VERSION (así lo ven todos otra vez) y la lista de PASOS; Novedades.jsx y Recorrido.jsx no cambian.
//
// Cada paso: `mock` (la animación de Mocks.jsx), `titulo`, `texto` (una línea), y opcionales:
// - `target`: selector (o función que devuelve el elemento) que se ilumina; sin él, la tarjeta va al centro.
// - `antes(ctx)`: lo que hace Work antes de mostrarlo (ir a una sección, cambiar de vista).
// - `tocar`: el elemento se puede tocar y tocarlo avanza (la tarjeta dice «Tocá acá»).
// - `accion`: un botón extra en la tarjeta `{ label, hacer(ctx) }`, que además cierra el recorrido.

// «-2»: se volvió a mostrar a todos (también a quien ya lo había visto), ahora obligatorio.
export const VERSION = '2026-11-25-2';
export const FECHA = '25 nov';

const tab = (tipo) => () => document.querySelector(`.cv-tab[data-tipo="${tipo}"]`);
const clicTab = (tipo) => () => {
    const el = tab(tipo)();
    if (el && el.getAttribute('aria-pressed') !== 'true') el.click();
};

export const PORTADA = [
    { id: 'riel', label: 'Tu día' },
    { id: 'calendario', label: 'Calendario' },
    { id: 'tarjeta', label: 'Tarjetas' },
    { id: 'confirmacion', label: 'Confirmación' },
    { id: 'reprogramar', label: 'Reprogramar' },
    { id: 'horario', label: 'Tu horario' },
];

export const PASOS = [
    {
        id: 'riel', mock: 'riel', target: '.ws-side',
        antes: (ctx) => ctx.ir('confirmations'),
        titulo: 'Tu día, siempre a la derecha',
        texto: 'Lo que te falta en Confirmar, Reportar y Seguir, tu racha y tus XP. Tocá una fila y vas directo.',
    },
    {
        id: 'vistas', mock: 'dias', target: tab('semana'), tocar: true,
        titulo: 'Nuevo: Calendario',
        texto: 'Mirá 1, 2, 3 o 7 días. Las teclas 1 a 9 cambian los días y T vuelve a hoy.',
    },
    {
        id: 'calendario', mock: 'llamada', target: '.cv-cal',
        antes: clicTab('semana'),
        titulo: 'Cada llamada dice todo',
        texto: 'Etiquetas de color con la etapa, el closer, quién decide, la inversión y los ingresos. El filtro separa Triage de Closing.',
    },
    {
        id: 'tarjeta', mock: 'tarjeta', target: '.kcard-v6',
        antes: clicTab('tablero'),
        titulo: 'El lead, de un vistazo',
        texto: 'El segmento es la letra sobre la foto. Debajo del teléfono, el examen y el país.',
    },
    {
        id: 'confirmacion', mock: 'confirmacion', target: '.kcard-v6',
        titulo: 'Confirmación, más simple',
        texto: 'Abrí una llamada: un solo botón para confirmar. Si algo cambió, Reprogramar, Canceló o No show.',
    },
    {
        id: 'reprogramar', mock: 'reprogramar',
        titulo: 'Reprogramar en dos toques',
        texto: 'Tocá con quién, el día y la hora. Cada persona con su color y la hora del lead con su bandera.',
    },
    {
        id: 'extras', mock: 'extras',
        titulo: 'Y además',
        texto: '',
    },
    {
        id: 'horario', mock: 'horario', target: '.dock-sesion',
        titulo: 'Tu horario, arrastrando',
        texto: 'En Configuración › Disponibilidad lo marcás sobre un calendario y ves tus cupos libres de los próximos 7 días.',
        accion: { label: 'Abrir mi horario', hacer: (ctx) => ctx.abrirConfiguracion('disponibilidad') },
    },
];
