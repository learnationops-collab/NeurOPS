// Cómo se ordena Herramientas (como `config/staff_tools.php` de la Academia): cada opción va a un grupo
// por tipo, con una línea que dice para qué sirve, su color y, si lleva a otra pantalla, la flecha.
// Las opciones salen de cada pantalla (MenuSesion), del catálogo en ventana (herramientas.js) y de las
// secciones ocultas; acá solo se les da lugar. Una opción que no está acá cae en «Esta pantalla».

export const GRUPOS = ['Crear', 'Buscar', 'Agendas', 'Asistente', 'Pendientes', 'Mi cuenta', 'Esta pantalla', 'Secciones ocultas', 'Ir a', 'Sesión'];

const CATALOGO = {
    nuevo: { grupo: 'Crear', desc: 'Una agenda, un pago, una venta o un pedido al equipo técnico.', color: 'rosa' },
    'tool:pedido-devs': { grupo: 'Crear', desc: 'Un cambio, un error o una duda de la plataforma, al Inbox de los devs.', color: 'violeta' },
    'tool:broadcast-wa': { grupo: 'Crear', desc: 'Una plantilla de WhatsApp a una lista de números, con el historial de lo mandado.', color: 'verde' },
    'tool:buscar': { grupo: 'Buscar', desc: 'Cualquier lead y su ficha · Ctrl+K', color: 'rosa' },
    playbook: { grupo: 'Asistente', desc: 'Los videos del Playbook.', color: 'verde' },
    simular: { grupo: 'Ir a', desc: 'Ver Work como lo ve otra persona.', color: 'violeta' },
    'tool:turnos': { grupo: 'Agendas', desc: 'Los turnos que quedan de triage y de closers, con sus horarios.', color: 'azul' },
    links: { grupo: 'Agendas', desc: 'Tus links de agendamiento: tocá uno para copiarlo.', color: 'azul' },
    learnito: { grupo: 'Asistente', desc: 'Preguntale lo que necesites · Ctrl+L', color: 'violeta' },
    inbox: { grupo: 'Pendientes', desc: 'Tus conversaciones de Instagram y WhatsApp.', color: 'rosa', va: true },
    avisos: { grupo: 'Pendientes', desc: 'Lo que el sistema te avisó.', color: 'ambar' },
    conflictos: { grupo: 'Pendientes', desc: 'Datos sueltos para revisar.', color: 'rojo' },
    'mis-reportes': { grupo: 'Pendientes', desc: 'Lo que reportaste o pediste, y sus respuestas.', color: 'verde' },
    'tool:mi-sueldo': { grupo: 'Mi cuenta', desc: 'Tu sueldo del mes: base, comisiones, bonos y los pagos que las suman.', color: 'verde' },
    procrastinar: { grupo: 'Esta pantalla', desc: 'Un seguimiento al azar para arrancar.', color: 'ambar' },
    portal: { grupo: 'Ir a', desc: 'Otra área o rol, Cortex (Playbook) y Simular.', color: 'azul' },
    'mi-espacio': { grupo: 'Ir a', desc: 'Tu pantalla de trabajo.', color: 'gris', va: true },
    operaciones: { grupo: 'Ir a', desc: 'El panel de Operaciones.', color: 'gris', va: true },
    volver: { grupo: 'Sesión', desc: 'Terminar la simulación.', color: 'gris' },
    salir: { grupo: 'Sesión', desc: 'Salir de Work en este navegador.', color: 'gris' },
};

/** La opción con su ficha: { ...op, grupo, desc, color, va }. Lo que dice la opción (`titulo`) gana. */
export function conFicha(op) {
    const base = CATALOGO[op.id] || (op.id.startsWith('sec:')
        ? { grupo: 'Secciones ocultas', desc: 'Sacada del dock: tocala para ir.', color: 'rosa', va: true }
        : { grupo: 'Esta pantalla', desc: '', color: 'gris' });
    return { ...base, ...op, desc: op.titulo || base.desc };
}

/** [{ titulo, opciones }] en el orden de GRUPOS, sin los vacíos. */
export function agrupar(opciones) {
    const fichas = opciones.map(conFicha);
    return GRUPOS.map(titulo => ({ titulo, opciones: fichas.filter(o => o.grupo === titulo) })).filter(g => g.opciones.length);
}
