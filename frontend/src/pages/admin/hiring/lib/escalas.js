// Escalas, colores y helpers compartidos por el panel de Hiring (postulaciones
// al puesto de Asistente Administrativa y Personal). Los campos y sus opciones
// vienen del formulario público (institute-site, vacante-assistant/formulario).

export const PAISES = ['Argentina', 'Venezuela', 'Brasil'];

// Un color sólido por país para gráficos (torta, barras, comparador): reusa la
// paleta ya presente en el resto del panel y evoca sueltamente cada bandera.
export const COLOR_PAIS = {
    Argentina: '#5B7CFF',
    Venezuela: '#D9A441',
    Brasil: '#2FBF8F',
};

// Swatch de bandera aproximado (franjas), para el punto de color junto al
// nombre de la candidata — más reconocible que un color plano.
export const BANDERA = {
    Argentina: 'linear-gradient(180deg,#75AADB 0%,#75AADB 33%,#fff 33%,#fff 66%,#75AADB 66%)',
    Venezuela: 'linear-gradient(180deg,#FCD116 0%,#FCD116 33%,#003893 33%,#003893 66%,#CF142B 66%)',
    Brasil: 'linear-gradient(135deg,#009739 0%,#009739 38%,#FEDD00 50%,#009739 62%,#009739 100%)',
};

// Híbrido (Salta/Argentina, Paraná/Brasil — puede ir a la oficina) vs. Online
// (todo el resto). La cuenta la hace el backend (`modalidad()` del modelo);
// esto es solo la presentación del badge.
export const MODALIDAD = {
    hibrido: { label: 'Híbrido', fg: '#FF6AD5', bg: 'rgba(255,63,164,.12)', bd: 'rgba(255,63,164,.45)' },
    online: { label: 'Online', fg: '#5B7CFF', bg: 'rgba(91,124,255,.12)', bd: 'rgba(91,124,255,.42)' },
};

export const soloDigitos = (texto) => (texto || '').replace(/\D/g, '');

// Asegura protocolo para que un link guardado sin "https://" siga siendo
// clickeable. Sin valor, no hay link.
export const href = (valor) => {
    const t = (valor || '').trim();
    if (!t) return null;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

// --- Escalas genéricas de nivel (Sheets, IA, inglés, segundo idioma) ---

const NIVEL5 = [
    { full: 'Nunca lo usé', corto: 'Nunca' },
    { full: 'Básico, me defiendo con lo esencial', corto: 'Básico' },
    { full: 'Intermedio, lo uso seguido sin ayuda', corto: 'Intermedio' },
    { full: 'Avanzado, resuelvo cosas complejas sola/o', corto: 'Avanzado' },
    { full: 'Experta/o, se lo podría enseñar a otra persona', corto: 'Experta/o' },
];

const IDIOMA4 = [
    { full: 'No lo hablo', corto: 'No lo habla' },
    { full: 'Básico', corto: 'Básico' },
    { full: 'Intermedio', corto: 'Intermedio' },
    { full: 'Avanzado o nativo', corto: 'Avanzado' },
];

/** Índice 0-4 de un valor dentro de NIVEL5 o IDIOMA4 (Sheets, IA, inglés,
 * segundo idioma). 0 si no matchea ninguna opción (sin respuesta). */
export const nivelDe = (valor) => {
    const n5 = NIVEL5.findIndex((o) => o.full === valor);
    if (n5 >= 0) return n5;
    const i4 = IDIOMA4.findIndex((o) => o.full === valor);
    return i4 >= 0 ? i4 : 0;
};

/** Versión corta de un valor de NIVEL5/IDIOMA4, para columnas angostas. */
export const nivelCorto = (valor) => {
    const n5 = NIVEL5.find((o) => o.full === valor);
    if (n5) return n5.corto;
    const i4 = IDIOMA4.find((o) => o.full === valor);
    if (i4) return i4.corto;
    return valor || '—';
};

// --- Escalas propias por campo (radios de 4-5 opciones, ya ordenadas de piso
// a techo) ---

const ESCALAS = {
    experiencia: [
        { full: 'No tengo experiencia en este tipo de puesto', corto: 'Sin experiencia' },
        { full: 'Menos de 1 año', corto: 'Menos de 1 año' },
        { full: 'Entre 1 y 2 años', corto: '1 a 2 años' },
        { full: 'Entre 3 y 5 años', corto: '3 a 5 años' },
        { full: 'Más de 5 años', corto: 'Más de 5 años' },
    ],
    digital: [
        { full: 'Nunca', corto: 'Nunca' },
        { full: 'Sí, menos de 1 año', corto: 'Menos de 1 año' },
        { full: 'Sí, entre 1 y 3 años', corto: '1 a 3 años' },
        { full: 'Sí, más de 3 años', corto: 'Más de 3 años' },
    ],
    remoto: [
        { full: 'Nunca trabajé remoto', corto: 'Nunca' },
        { full: 'Menos de 1 año', corto: 'Menos de 1 año' },
        { full: 'Entre 1 y 3 años', corto: '1 a 3 años' },
        { full: 'Más de 3 años', corto: 'Más de 3 años' },
    ],
    dinero: [
        { full: 'No, nunca', corto: 'Nunca' },
        { full: 'Cargaba datos que otra persona revisaba', corto: 'Cargaba datos' },
        { full: 'Preparaba pagos o liquidación de comisiones', corto: 'Pagos y comisiones' },
        { full: 'Era responsable del control financiero', corto: 'Control financiero' },
    ],
    pm: [
        { full: 'No', corto: 'No' },
        { full: 'Informalmente, sin que fuera mi rol', corto: 'Informal' },
        { full: 'Sí, con 2 a 5 personas', corto: '2 a 5 personas' },
        { full: 'Sí, con más de 5 personas', corto: 'Más de 5 personas' },
    ],
    educacion: [
        { full: 'Secundario completo', corto: 'Secundario' },
        { full: 'Terciario o técnico', corto: 'Terciario o técnico' },
        { full: 'Universitario en curso', corto: 'Univ. en curso' },
        { full: 'Universitario completo', corto: 'Universitario' },
        { full: 'Posgrado', corto: 'Posgrado' },
    ],
    meta: [
        { full: 'Nunca entré', corto: 'Nunca entró' },
        { full: 'Entré pero no publiqué anuncios', corto: 'Sin publicar' },
        { full: 'Publiqué anuncios siguiendo instrucciones', corto: 'Con instrucciones' },
        { full: 'Monto y publico campañas sola/o', corto: 'Monta campañas' },
        { full: 'Gestioné cuentas publicitarias de forma habitual', corto: 'Gestión habitual' },
    ],
    notion: [
        { full: 'Nunca lo usé', corto: 'Nunca' },
        { full: 'Lo usé como bloc de notas', corto: 'Bloc de notas' },
        { full: 'Creo páginas y bases de datos simples', corto: 'Bases simples' },
        { full: 'Creo bases de datos con vistas, filtros y propiedades', corto: 'Vistas y filtros' },
        { full: 'Creo bases de datos relacionadas y sistemas completos', corto: 'Sistemas completos' },
    ],
    // El formulario ofrece estas opciones de más a menos avanzado; acá van
    // invertidas (ascendente) para que el índice sea directamente el nivel,
    // igual que el resto de las escalas.
    wa_tools: [
        { full: 'No', corto: 'No' },
        { full: 'Las conozco pero no las usé', corto: 'Las conoce' },
        { full: 'Sí, mandé difusiones o campañas simples', corto: 'Difusiones simples' },
        { full: 'Sí, armé flujos automáticos y campañas', corto: 'Flujos automáticos' },
    ],
    automatizaciones: [
        { full: 'Nunca las usé', corto: 'Nunca' },
        { full: 'Entiendo el concepto de disparador y acción', corto: 'Entiende el concepto' },
        { full: 'Armé automatizaciones simples', corto: 'Simples' },
        { full: 'Armo automatizaciones con varios pasos y condiciones', corto: 'Multi-paso' },
    ],
    // "¿Cómo manejás tus pendientes?": el formulario ofrece de más a menos
    // ordenado; acá van ascendentes, como el resto de las escalas.
    pendientes: [
        { full: 'Voy resolviendo lo que va apareciendo', corto: 'Sin sistema' },
        { full: 'Lo anoto cuando me acuerdo', corto: 'Lo anota a veces' },
        { full: 'Uso una lista de tareas simple', corto: 'Lista simple' },
        { full: 'Tengo un sistema propio (tablero o lista priorizada) y lo actualizo todos los días', corto: 'Sistema propio' },
    ],
};

/** {n, max, ok, label} de un valor dentro de la escala propia de `campo` (n=0
 * es el piso de esa escala, `max` su techo). `ok` es false cuando el valor no
 * matchea ninguna opción (vacío o redactado distinto): n=0 ahí no significa
 * "nivel más bajo", significa "no se pudo medir". */
export const escalaDe = (campo, valor) => {
    const escala = ESCALAS[campo];
    if (!escala) return { n: 0, max: 0, ok: false, label: valor || '—' };
    const idx = escala.findIndex((o) => o.full === valor);
    if (idx < 0) return { n: 0, max: escala.length - 1, ok: false, label: valor || 'Sin respuesta' };
    return { n: idx, max: escala.length - 1, ok: true, label: escala[idx].corto };
};

/** Puntaje 1-5 (las estrellitas de una tarjeta) de un nivel `n` dentro de una
 * escala 0..max. Escalas de distinto largo caen todas en el mismo 1-5. */
export const estrellas = (n, max) => 1 + Math.round((n / max) * 4);

// --- Techo de uso de IA: 8 opciones de "casi no la usa" a "construyó algo
// funcional", comprimidas a una escala de 0-4 para los 4 puntitos. ---

const TECHO_IA = [
    { full: 'Casi no la uso', corto: 'Casi no la usa' },
    { full: 'Le hago preguntas sueltas y uso lo que me devuelve', corto: 'Preguntas sueltas' },
    { full: 'La uso para redactar, resumir o corregir textos', corto: 'Redacta/resume' },
    { full: 'Escribo prompts con contexto y ejemplos, y voy corrigiendo hasta que sale lo que quiero', corto: 'Prompts con contexto' },
    { full: 'Uso GPTs, proyectos o plugins que ya existen, con prompts armados por mí', corto: 'Usa GPTs existentes' },
    { full: 'Creé mis propios GPTs o asistentes personalizados para tareas que repito', corto: 'Creó GPTs propios' },
    { full: 'Armé agentes o flujos donde la IA se conecta con otras aplicaciones y ejecuta tareas', corto: 'Armó agentes/flujos' },
    { full: 'Construí algo funcional con IA: una herramienta, un dashboard, un script o una automatización que después corre sola', corto: 'Construyó herramientas' },
];

export const techoIA = (valor) => {
    const idx = TECHO_IA.findIndex((o) => o.full === valor);
    if (idx < 0) return { n: 0, max: 4, ok: false, label: valor ? valor.slice(0, 28) : 'Sin respuesta' };
    return { n: Math.round((idx / (TECHO_IA.length - 1)) * 4), max: 4, ok: true, label: TECHO_IA[idx].corto };
};

// --- Encabezados cortos para las 41 preguntas (rieles y grilla de respuestas) ---

export const PREGUNTA_CORTA = {
    pais: 'País', nombre: 'Nombre', email: 'Email', whatsapp: 'WhatsApp', edad: 'Edad',
    equipo: 'Equipo', disponibilidad: 'Jornada 4 → 8', horario: 'Horario', empleo: 'Otro empleo',
    confirma: 'Confirmación', remuneracion: 'Pide/mes',
    experiencia: 'Asistente / Ops', digital: 'Negocio digital', remoto: 'Remoto', dinero: 'Dinero',
    pm: 'Coordinación', educacion: 'Estudios', area: 'Área',
    idioma2: 'Idioma 2', ingles: 'Inglés',
    sheets: 'Sheets', ia_nivel: 'Nivel IA', ia_avanzado: 'Techo IA',
    ia_construido: 'Qué construyó', ia_uso: 'Uso de IA',
    meta: 'Meta Ads', meta_presupuesto: 'Presupuesto Ads', notion: 'Notion',
    wa_tools: 'WhatsApp masivo', automatizaciones: 'Automatizaciones', automatizacion_ejemplo: 'Automatización',
    diseno: 'Diseño', diseno_link: 'Link diseño',
    aporte: 'Aporte diferencial',
    pendientes: 'Pendientes', instrucciones: 'Instrucciones',
    retraso: 'Retraso', monitor: 'Caso: monitor', martes: 'Caso: priorizar',
    video: 'Video', video_verificado: 'Video verificado', cv: 'CV',
};

// Preguntas de respuesta escrita (texto libre, sea un párrafo o una línea): se
// agrupan aparte de las de opción y arrancan colapsadas, porque hay que
// leerlas, no compararlas de un vistazo.
export const CAMPOS_ESCRITOS = new Set([
    'ia_construido', 'ia_uso', 'meta_presupuesto', 'automatizacion_ejemplo', 'diseno_link',
    'aporte', 'instrucciones', 'retraso', 'martes',
]);

// Versión corta de las respuestas de los 4 excluyentes + la verificación de
// comprensión (riel "Requisitos"), para que quepan en una línea. El espacio
// entre un número y su unidad es no separable ( ): en el riel angosto el
// texto se parte, pero nunca deja "8" en una línea y "h" en la siguiente.
export const VAL_CORTO = {
    'Sí, las tres cosas': 'Las tres cosas',
    'Tengo computadora y celular, pero mi internet falla seguido': 'Internet inestable',
    'Me falta alguna de las tres': 'Falta algo',
    'Sí, las 4 horas ahora y las 8 desde el tercer mes': '4 h hoy · 8 h al 3.er mes',
    'Solo podría las 4 horas, no podría escalar a 8': 'Solo 4 h, no escala',
    'No tengo esa disponibilidad': 'Sin disponibilidad',
    'Sí, me organizo sin problema': 'Se organiza sin problema',
    'No, necesito un horario fijo y cerrado': 'Necesita horario fijo',
    'No': 'No tiene otro',
    'Sí, medio tiempo o freelance, y podría acomodarlo': 'Medio tiempo, acomodable',
    'Sí, tiempo completo, y lo mantendría': 'Full-time, lo mantiene',
    'Arranco con 4 horas diarias y desde el tercer mes paso a 8 horas': 'Entendió: 4 h → 8 h',
    'Arranco con 8 horas diarias desde el primer día': 'Creyó que arranca en 8 h',
    'Son 4 horas diarias siempre, no cambia': 'Creyó que no escala',
    'Son 8 horas los primeros dos meses y después bajan a 4': 'Creyó que baja a 4 h',
};

// Versión corta de las 6 opciones de área de formación.
export const AREA_CORTO = {
    'Administración, contabilidad o finanzas': 'Administración y finanzas',
    'Marketing, comunicación o publicidad': 'Marketing y comunicación',
    'Psicología, recursos humanos o educación': 'Psicología y RR. HH.',
    'Ingeniería, sistemas o datos': 'Ingeniería y datos',
    'Otra área': 'Otra área',
    'No tengo formación terciaria ni universitaria': 'Sin formación terciaria',
};
