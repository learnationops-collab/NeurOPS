// Estructuras para arrancar un flujo. El texto es de ejemplo: se reemplaza antes de publicar. Cada
// plantilla es un grafo válido para el motor (app/automatizaciones/nucleo/grafo.py), así que se puede
// probar tal cual; solo le falta la palabra clave.

const texto = (t) => [{ tipo: 'texto', texto: t }];
const en = (x, y) => ({ x: x * 320, y: y * 220 });

const LEAD_MAGNET = {
    disparadores: [{ id: 'd1', canal: 'dm', palabras: [], coincidencia: 'exacta' }],
    inicio: 'apertura',
    posicion_inicio: en(-1, 0),
    nodos: [
        { id: 'apertura', tipo: 'mensaje', nombre: 'Apertura', posicion: en(0, 0),
          contenido: texto('¡Hola! Ya te paso el recurso. Antes, contame: ¿cuál es tu perfil?'),
          botones: [{ id: 'b_graduado', titulo: 'Médico graduado' }, { id: 'b_estudiante', titulo: 'Estudiante' }],
          sin_respuesta: { minutos: 360 } },
        { id: 'examen', tipo: 'mensaje', nombre: 'Examen', posicion: en(1, 0),
          contenido: texto('Genial. ¿Para qué examen te estás preparando?'), espera: { guardar_en: 'examen' } },
        { id: 'dolor', tipo: 'mensaje', nombre: 'Dolor', posicion: en(2, 0),
          contenido: texto('¿Qué te gustaría mejorar primero?'),
          botones: [{ id: 'b_tiempo', titulo: 'Tiempo' }, { id: 'b_retencion', titulo: 'Retención' }, { id: 'b_puntaje', titulo: 'Puntaje' }] },
        { id: 'entrega', tipo: 'mensaje', nombre: 'Entrega', posicion: en(3, 0),
          contenido: texto('Acá tenés el recurso: https://… Contame qué te pareció.') },
        { id: 'califica', tipo: 'accion', nombre: 'Califica', posicion: en(4, 0), acciones: [{ tipo: 'califica', valor: true }] },
        { id: 'no_califica', tipo: 'accion', nombre: 'No califica', posicion: en(1, 1), acciones: [{ tipo: 'califica', valor: false }] },
        { id: 'entrega_estudiante', tipo: 'mensaje', nombre: 'Entrega estudiante', posicion: en(2, 1),
          contenido: texto('Acá tenés el recurso: https://…') },
        { id: 'seguimiento', tipo: 'mensaje', nombre: 'Seguimiento', posicion: en(1, -1), contenido: texto('¿Seguís por ahí?') },
        { id: 'fin', tipo: 'fin', posicion: en(5, 0) },
    ],
    conexiones: [
        { id: 'c1', desde: 'apertura', salida: 'b_graduado', hacia: 'examen' },
        { id: 'c2', desde: 'apertura', salida: 'b_estudiante', hacia: 'no_califica' },
        { id: 'c3', desde: 'apertura', salida: 'sin_respuesta', hacia: 'seguimiento' },
        { id: 'c4', desde: 'examen', salida: 'respuesta', hacia: 'dolor' },
        { id: 'c5', desde: 'dolor', salida: 'b_tiempo', hacia: 'entrega' },
        { id: 'c6', desde: 'dolor', salida: 'b_retencion', hacia: 'entrega' },
        { id: 'c7', desde: 'dolor', salida: 'b_puntaje', hacia: 'entrega' },
        { id: 'c8', desde: 'entrega', salida: 'siguiente', hacia: 'califica' },
        { id: 'c9', desde: 'califica', salida: 'siguiente', hacia: 'fin' },
        { id: 'c10', desde: 'no_califica', salida: 'siguiente', hacia: 'entrega_estudiante' },
    ],
};

const LLAMADA = {
    disparadores: [{ id: 'd1', canal: 'dm', palabras: [], coincidencia: 'exacta' }],
    inicio: 'invitacion',
    posicion_inicio: en(-1, 0),
    nodos: [
        { id: 'invitacion', tipo: 'mensaje', nombre: 'Invitación', posicion: en(0, 0),
          contenido: texto('¿Te muestro en 15 minutos cómo lo armaríamos para tu examen?'),
          botones: [{ id: 'b_si', titulo: 'Sí, agendemos' }, { id: 'b_despues', titulo: 'Más adelante' }] },
        { id: 'agenda', tipo: 'mensaje', nombre: 'Agenda', posicion: en(1, -0.5),
          contenido: texto('Elegí el horario que te quede cómodo: https://…') },
        { id: 'espera', tipo: 'esperar', nombre: 'Un día', posicion: en(1, 0.5), minutos: 1440 },
        { id: 'recordatorio', tipo: 'mensaje', nombre: 'Recordatorio', posicion: en(2, 0.5),
          contenido: texto('Te dejo el link por si te queda bien esta semana: https://…') },
        { id: 'fin', tipo: 'fin', posicion: en(3, 0) },
    ],
    conexiones: [
        { id: 'c1', desde: 'invitacion', salida: 'b_si', hacia: 'agenda' },
        { id: 'c2', desde: 'invitacion', salida: 'b_despues', hacia: 'espera' },
        { id: 'c3', desde: 'espera', salida: 'siguiente', hacia: 'recordatorio' },
        { id: 'c4', desde: 'agenda', salida: 'siguiente', hacia: 'fin' },
        { id: 'c5', desde: 'recordatorio', salida: 'siguiente', hacia: 'fin' },
    ],
};

const COMENTARIO = {
    disparadores: [{ id: 'd1', canal: 'comentario', palabras: [], coincidencia: 'contiene', publicacion_id: null }],
    inicio: 'respuesta',
    posicion_inicio: en(-1, 0),
    nodos: [
        // La respuesta privada a un comentario es una sola: el resto va cuando toque el botón.
        { id: 'respuesta', tipo: 'mensaje', nombre: 'Respuesta al comentario', posicion: en(0, 0),
          contenido: texto('¡Gracias por comentar! ¿Querés que te lo mande por acá?'),
          botones: [{ id: 'b_quiero', titulo: 'Sí, mandámelo' }] },
        { id: 'entrega', tipo: 'mensaje', nombre: 'Entrega', posicion: en(1, 0), contenido: texto('Acá lo tenés: https://…') },
        { id: 'fin', tipo: 'fin', posicion: en(2, 0) },
    ],
    conexiones: [
        { id: 'c1', desde: 'respuesta', salida: 'b_quiero', hacia: 'entrega' },
        { id: 'c2', desde: 'entrega', salida: 'siguiente', hacia: 'fin' },
    ],
};

export const PLANTILLAS = [
    { id: 'lead_magnet', nombre: 'Lead magnet por palabra clave', detalle: 'Califica por perfil y examen, y entrega', grafo: LEAD_MAGNET },
    { id: 'llamada', nombre: 'Invitación a llamada', detalle: 'Agenda directa y recordatorio al día', grafo: LLAMADA },
    { id: 'comentario', nombre: 'Comentario → mensaje', detalle: 'Contesta un comentario y entrega por DM', grafo: COMENTARIO },
];
