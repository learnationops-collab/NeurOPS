import { Bug, Lightbulb, ClipboardList } from 'lucide-react';

// Tipos de reporte (mismo orden que REPORT_TYPES del backend: bug, solicitud, mejora). Una sola
// fuente para el chat, el historial del usuario y el panel del operador. 'solicitud' = pedido
// concreto de trabajo al equipo de desarrollo, para que no quede solo en el chat (ADR-W151).
export const REPORT_TYPES = [
    {
        id: 'bug', label: 'Bug', icon: Bug,
        text: 'text-rose-400',
        chip: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        boton: 'hover:border-rose-500/50 hover:bg-rose-500/5',
        icono: 'bg-rose-500/10 text-rose-500',
        titulo: 'Encontré un problema',
        sub: 'Algo no está funcionando como debería',
        pregunta: '¿Cuál es el problema?',
        placeholder: 'Describe el problema...',
        preguntaContexto: '¿Qué intentabas hacer cuando apareció el error o problema?',
        placeholderContexto: 'Escribe qué estabas haciendo...',
    },
    {
        id: 'solicitud', label: 'Solicitud', icon: ClipboardList,
        text: 'text-sky-400',
        chip: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        boton: 'hover:border-sky-500/50 hover:bg-sky-500/5',
        icono: 'bg-sky-500/10 text-sky-500',
        titulo: 'Necesito que me hagan algo',
        sub: 'Un pedido concreto: un acceso, cargar o corregir un dato, un reporte',
        pregunta: '¿Qué necesitás que hagamos?',
        placeholder: 'Describe lo que necesitás...',
        preguntaContexto: '¿Para qué lo necesitás y para cuándo?',
        placeholderContexto: 'Contanos el contexto y si tiene fecha...',
    },
    {
        id: 'mejora', label: 'Mejora', icon: Lightbulb,
        text: 'text-amber-400',
        chip: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        boton: 'hover:border-amber-500/50 hover:bg-amber-500/5',
        icono: 'bg-amber-500/10 text-amber-500',
        titulo: 'Tengo una idea o sugerencia',
        sub: 'Una mejora para la app, no es un error',
        pregunta: '¿Qué mejora o idea te gustaría proponer?',
        placeholder: 'Describe tu idea o sugerencia...',
        preguntaContexto: '¿Por qué te serviría este cambio? Contanos el contexto.',
        placeholderContexto: 'Escribe el contexto de tu idea...',
    },
];

const POR_ID = Object.fromEntries(REPORT_TYPES.map((t) => [t.id, t]));

// Lo desconocido (o un reporte viejo sin tipo) se muestra como bug, igual que el default del backend.
export const reportTypeMeta = (id) => POR_ID[id] || POR_ID.bug;
