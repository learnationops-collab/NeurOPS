// Datos de ejemplo del laboratorio de Agendas 2.0. Nada de esto sale de la base ni se guarda:
// las pantallas de prueba no tienen backend todavía. Closers ficticios a propósito, para que nadie
// confunda una simulación con el reparto real.

export const CLOSERS = [
    { id: 'lucia', nombre: 'Lucía Ferreyra', tz: 'America/Argentina/Buenos_Aires', semana: { 1: [['09:00', '13:00'], ['15:00', '19:00']], 2: [['09:00', '13:00']], 3: [['09:00', '13:00'], ['15:00', '19:00']], 4: [['15:00', '20:00']], 5: [['09:00', '14:00']] } },
    { id: 'martin', nombre: 'Martín Rojas', tz: 'America/La_Paz', semana: { 1: [['10:00', '18:00']], 2: [['10:00', '18:00']], 3: [['10:00', '14:00']], 4: [['10:00', '18:00']], 5: [['10:00', '16:00']], 6: [['09:00', '12:00']] } },
    { id: 'sofia', nombre: 'Sofía Andrade', tz: 'America/Bogota', semana: { 1: [['08:00', '12:00']], 2: [['08:00', '12:00'], ['14:00', '18:00']], 3: [['14:00', '18:00']], 4: [['08:00', '12:00'], ['14:00', '18:00']], 5: [['08:00', '12:00']] } },
    { id: 'tomas', nombre: 'Tomás Herrera', tz: 'America/Mexico_City', semana: { 1: [['09:00', '17:00']], 3: [['09:00', '17:00']], 5: [['09:00', '17:00']], 6: [['10:00', '14:00']] } },
    { id: 'valentina', nombre: 'Valentina Paz', tz: 'America/Sao_Paulo', semana: { 2: [['13:00', '19:00']], 3: [['13:00', '19:00']], 4: [['13:00', '19:00']], 5: [['13:00', '19:00']] } },
];

export const closerPorId = (id) => CLOSERS.find(c => c.id === id);

// Lo que ya se asignó esta semana, por closer. Las cuotas mínimas y máximas se miden contra esto.
export const ASIGNADAS_SEMANA = { lucia: 7, martin: 4, sofia: 9, tomas: 2, valentina: 5 };

// Opciones de ejemplo: el formulario real vive hoy en Calendly y su fórmula de puntaje en n8n.
export const PREGUNTAS = [
    { id: 'examen', texto: '¿Qué examen vas a rendir?', ayuda: 'Así sabemos cuánto tiempo de preparación tenés por delante.', opciones: ['Residencia 2027', 'Residencia 2028 o después', 'Examen de habilitación', 'Todavía no lo decidí'] },
    { id: 'formacion', texto: '¿En qué etapa de la carrera estás?', opciones: ['Médico/a recibido/a', 'Internado', 'Últimos años de la carrera', 'Primeros años de la carrera'] },
    { id: 'empleo', texto: '¿Trabajás actualmente?', opciones: ['No, me dedico a estudiar', 'Sí, medio tiempo', 'Sí, tiempo completo'] },
    { id: 'puntaje', texto: '¿Cuántos puntos necesitás subir?', ayuda: 'Una estimación alcanza.', opciones: ['Más de 20', 'Entre 10 y 20', 'Menos de 10', 'Todavía no rendí'] },
    { id: 'inversion', texto: 'Si el programa es para vos, ¿podés invertir en tu preparación?', opciones: ['Sí, puedo invertir ahora', 'Sí, en 1 a 3 meses', 'Necesitaría financiación', 'No puedo invertir ahora'] },
    { id: 'apoyo', texto: '¿Quién decide sobre esa inversión?', opciones: ['Yo', 'Lo decido con mi familia o pareja', 'Otra persona'] },
    { id: 'interes', texto: '¿Qué te gustaría resolver en la llamada?', tipo: 'texto', placeholder: 'Contalo en una o dos frases' },
];

export const FUNNELS = [
    { id: 'workshop', nombre: 'Workshop', reunion: { titulo: 'Llamada de diagnóstico', duracion: 45, margen: 15, avisoMinHoras: 3, horizonteDias: 10 } },
    { id: 'vsl', nombre: 'VSL', reunion: { titulo: 'Llamada de diagnóstico', duracion: 45, margen: 15, avisoMinHoras: 4, horizonteDias: 7 } },
    { id: 'setting', nombre: 'Setting', reunion: { titulo: 'Llamada de diagnóstico', duracion: 45, margen: 15, avisoMinHoras: 2, horizonteDias: 10 } },
];

export const funnelPorId = (id) => FUNNELS.find(f => f.id === id) || FUNNELS[0];

export const ESTRATEGIA_BASE = {
    version: 3,
    scoring: {
        examen: { peso: 2, opciones: { 'Residencia 2027': 10, 'Residencia 2028 o después': 6, 'Examen de habilitación': 7, 'Todavía no lo decidí': 2 } },
        formacion: { peso: 1, opciones: { 'Médico/a recibido/a': 10, 'Internado': 8, 'Últimos años de la carrera': 5, 'Primeros años de la carrera': 1 } },
        empleo: { peso: 1, opciones: { 'No, me dedico a estudiar': 8, 'Sí, medio tiempo': 6, 'Sí, tiempo completo': 4 } },
        puntaje: { peso: 1, opciones: { 'Más de 20': 9, 'Entre 10 y 20': 10, 'Menos de 10': 6, 'Todavía no rendí': 5 } },
        inversion: { peso: 3, opciones: { 'Sí, puedo invertir ahora': 10, 'Sí, en 1 a 3 meses': 6, 'Necesitaría financiación': 4, 'No puedo invertir ahora': 0 } },
        apoyo: { peso: 1, opciones: { 'Yo': 10, 'Lo decido con mi familia o pareja': 7, 'Otra persona': 3 } },
    },
    descalificadores: [
        { pregunta: 'inversion', opcion: 'No puedo invertir ahora', segmento: 'S3' },
    ],
    segmentos: [
        { id: 'S1', nombre: 'Alta intención', desde: 70 },
        { id: 'S2', nombre: 'Media', desde: 45 },
        { id: 'S3', nombre: 'Nutrir', desde: 0 },
    ],
    enrutamiento: {
        S1: { modo: 'prioridad', desborde: 'S2', cola: [{ closer: 'lucia', min: 6, max: 12 }, { closer: 'sofia', max: 10 }, { closer: 'martin', max: 8 }] },
        S2: { modo: 'simetrico', desborde: 'S3', cola: [{ closer: 'martin', max: 14 }, { closer: 'valentina', max: 14 }, { closer: 'sofia', max: 6 }] },
        S3: { modo: 'ponderado', desborde: null, cola: [{ closer: 'tomas', peso: 2 }, { closer: 'valentina', peso: 1 }] },
    },
    oferta: { minHorarios48h: 6 },
};

// Segunda etapa, después de agendar: videos con una pregunta cada uno, para que el lead llegue
// a la llamada habiendo visto lo que hoy el closer manda a mano por WhatsApp (VideoAsk, testimonio).
export const PREPARACION = [
    { id: 'bienvenida', titulo: 'Qué va a pasar en tu llamada', duracion: '2:10', pregunta: { texto: '¿Qué es lo que más te preocupa de tu preparación hoy?', opciones: ['No tengo un método', 'No me alcanza el tiempo', 'Me cuesta retener lo que estudio', 'Me pongo nervioso/a en el examen'] } },
    { id: 'testimonio', titulo: 'Cómo Carla subió 24 puntos trabajando', duracion: '3:40', pregunta: { texto: '¿Te ves en una situación parecida a la de Carla?', opciones: ['Sí, muy parecida', 'En parte', 'No mucho'] } },
    { id: 'metodo', titulo: 'Por qué resumir no funciona', duracion: '4:05', pregunta: { texto: 'Antes de la llamada, contanos en una frase cómo estudiás hoy.', tipo: 'texto', placeholder: 'Por ejemplo: leo, subrayo y hago resúmenes' } },
];

// Ocupación de ejemplo: determinística para que la pantalla no cambie en cada render.
export function ocupadoDemo(closerId, startUtc) {
    let h = 0;
    const s = `${closerId}:${Math.floor(startUtc / 60000)}`;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 100 < 38;
}
