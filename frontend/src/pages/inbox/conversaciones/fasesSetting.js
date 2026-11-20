// Las fases del setting (ADR-W184, estructura de setting de Mario, 20/11/2026): subdividen las tres etapas
// (Automática, Manual, Agendamiento). El servidor guarda solo el id (app/automatizaciones/fases.py); el guión de
// cada fase vive acá. `ojo`: lo que el setter tiene que revisar antes de mandar. `(NOMBRE)` y `(problema)` se
// completan a mano o con la variable del lead.

export const TRAMOS = {
    auto: { nombre: 'Automática', color: 'var(--info)' },
    manual: { nombre: 'Manual', color: '#7D63E6' },
    agenda: { nombre: 'Agendamiento', color: 'var(--warning)' },
    salida: { nombre: 'Sale del embudo', color: 'var(--error)' },
};

export const FASES = [
    { id: 'apertura', n: 1, tramo: 'auto', label: 'Apertura', guion: [
        { v: 'Automática', t: 'Genial, ya te lo mando 🙌 Antes, para qué examen te estás preparando: ENARM, MIR, STEP, EUNACOM o cuál?' }] },
    { id: 'conexion', n: 2, tramo: 'manual', label: 'Conexión y situación actual', corto: 'Conexión',
        ojo: ['ENARM y próximo año: preguntar si está en su servicio. Si sigue en el servicio, descalificar.',
            'MIR 2028: preguntar si ya empezó a prepararse o está en cero.'],
        guion: [
            { v: 'a · Fecha', t: 'Perfecto, y para cuándo te estarás presentando, más o menos? Para ver cuál es la guía que más se adapte a tu caso' },
            { v: 'b · Este año', t: 'Ahh genial, te presentarás en este año o apuntás al próximo año? Para ver cuál es la guía que más se adapte a tu caso' },
            { v: 'Método', t: 'Hoy ya venís estudiando con algún método o academia, o estás medio a la deriva con eso? Así podés aplicarla con el material correcto' },
            { v: 'Servicio (ENARM)', t: 'Estás en tu servicio aún o ya lo has terminado?' },
            { v: 'MIR 2028', t: 'Ahhh falta, pero ya iniciaste a prepararte o estás en cero todavía?' },
            { v: 'Puntaje (opcional)', t: 'Cómo venís con el puntaje hoy, cuál es tu puntaje actual? Y sabés cuánto necesitás para entrar a la especialidad que querés?' },
        ] },
    { id: 'dolor', n: 3, tramo: 'manual', label: 'Dolor',
        ojo: ['Si no menciona ninguna dificultad, ponerle la etiqueta: procrastinación, retención, concentración, organización.'],
        guion: [
            { v: 'Prueba 29/10', t: 'Contame, qué puntos te gustaría mejorar de tu metodología de estudio?' },
            { v: 'Dificultades', t: 'Contame, qué dificultades estás teniendo en tu preparación? O si no tenés ninguna dificultad, qué es lo que más te gustaría mejorar urgentemente' },
            { v: 'Si está en cero', t: 'Y qué sentís o creés que es lo que más te puede dificultar en tu preparación? O si no tenés ninguna dificultad, qué es lo que más te gustaría mejorar de tu metodología de estudio' },
            { v: 'Profundizar · audio Mario', t: 'Contame un poco cómo vivís en tu día a día esta falta de (problema), cómo lo experimentás o cómo te afecta? Podés extenderte todo lo que necesites, así puedo orientarte mejor' },
            { v: 'Ya invirtió', t: 'O sea que ya invertiste dinero en material, academias y aun así no lográs superar (problema)... Ese es justo el punto, el problema nunca fue el material sino cómo lo aprovechás, lo veo muy seguido!' },
            { v: 'Tiempo', t: 'Hace cuánto te viene pasando esto?' },
        ] },
    { id: 'consecuencia', n: 4, tramo: 'manual', label: 'Consecuencia / urgencia', corto: 'Consecuencia', guion: [
        { v: 'Versión A', t: 'Sentís que si mejorás esos puntos podrías tener un mejor rendimiento en tu preparación?' },
        { v: 'Versión B', t: 'Che, y sentís que si seguís igual vas a poder alcanzar el puntaje para la especialidad que deseás o necesitás hacer algunos ajustes?' }] },
    { id: 'compromiso', n: 5, tramo: 'manual', label: 'Compromiso', guion: [
        { v: 'Versión A', t: '(NOMBRE), entonces para entenderte mejor y ver qué puedo recomendarte: esto es una prioridad que querés resolver ahora cuanto antes, o quizás hay otras prioridades hoy y es algo más de "bueno, en algún momento veré de solucionarlo"?' },
        { v: 'Versión B', t: 'Sentís que llegarías con la preparación necesaria para alcanzar el puntaje que necesitás, o ves que hoy esto es algo que necesitás priorizar y ajustar?' }] },
    { id: 'propuesta', n: 6, tramo: 'manual', label: 'Propuesta de agenda', corto: 'Propuesta',
        ojo: ['Elegir la 1.ª parte (opción 1 u opción 2) y después pasar a la 2.ª parte.'],
        guion: [
            { v: '1.ª parte · opción 1', t: 'Ahh ok, estás comprometido con conseguirlo digamos. Mirá, te cuento qué sucede entonces: en estos 3 años ayudando a médicos me di cuenta que casi nadie tiene diagnóstico correcto de sus problemas de preparación, ni un plan basado en ciencia de cómo solucionarlos 🤷🏻‍♂️ El primer paso es saber las causas de (problema) y cuál es el mejor sistema adaptado a vos, para que logres no solo (resultado deseado) sino que tu puntaje suba. Justo por eso te quería proponer algo' },
            { v: '1.ª parte · opción 2', t: 'Bien, te cuento entonces: en estos 3 años ayudando a médicos me di cuenta que todos se saltan el primer paso 🤷🏻‍♂️ Antes de ir por academias o cursos, tenés que saber qué está causando (problema) y cuál es el sistema de aprendizaje que más se adapta a vos, para que logres subir tus scores semana a semana sin estancarte. Siento que te pasa lo mismo y justo por eso te quería proponer algo' },
            { v: '2.ª parte', t: 'Mirá, esta semana estamos dando algunas consultorías gratuitas. En el diagnóstico vemos tu examen, la causa de tus desafíos principales, identificamos tu forma de aprendizaje y te damos algunas recomendaciones, te sirve si armamos un diagnóstico de tu caso? Si te gustaría trabajarlo con nosotros la puerta está abierta y si no por lo menos tenés una guía clara de por qué (problema) y cómo trabajarlo. Querés aprovechar un cupo free?' },
        ] },
    { id: 'link', n: 7, tramo: 'agenda', label: 'Link',
        ojo: ['Si no tiene horario: preguntar en qué horarios podría, consultar a los closers y agendar en cualquier horario; el closer lo mueve.'],
        guion: [
            { v: 'Link', t: 'Bien, acá te paso el link para que puedas agendar tu cupo: (link de tu agenda). Es importante que agendes en un espacio que no te choque con el trabajo u otra actividad, para que podamos hacer un buen diagnóstico; si no conseguís uno avisame y te doy una mano. Me quedo por acá hasta que logres reservar, confirmame cuando esté por favor' }] },
    { id: 'confirmacion', n: 8, tramo: 'agenda', label: 'Confirmación',
        ojo: ['Al terminar el día, el mensaje para las agendas del día.'],
        guion: [
            { v: 'Agendó', t: '(NOMBRE), ahí vi que agendaste! A la brevedad mi equipo te va a escribir por WhatsApp para terminar de confirmar tu sesión y que la puedas aprovechar. Estate atento al WhatsApp porfa! Por cierto, cuando puedas revisá estos videos, son de preparación para que estés ready para tu sesión: https://work.thelearnation.com/agendas-v2/agenda/gracias/dn8r3h65btk' },
            { v: 'Fin del día', t: '(NOMBRE), recién me libero de unas consultorías, te pudiste contactar con Darían para confirmar tu sesión?' }] },
    { id: 'nolead', n: '×', tramo: 'salida', label: 'No lead (descalificado)', corto: 'No lead',
        ojo: ['Estudiante, internado, otra carrera o servicio social/rural. Si la automatización no salió, mandar desde el 1, a mano.',
            'Si busca ayuda personalizada se prospecta igual: preguntar en qué carrera y etapa está, y seguir la estructura normal.'],
        guion: [
            { v: '1 · Problema', t: 'Entiendo, en ese caso contame, qué dificultades estás teniendo en tu preparación y necesitás mejorar de tus métodos? (Retención · Procrastinación · Puntaje)' },
            { v: '2 · Recurso', t: 'Entiendo! Te paso por acá una clase donde explico cómo he ayudado a médicos a solucionar ese problema y al final de la clase te dejo herramientas que podés aplicar en tu estudio' },
            { v: '3 · Audio Mario (3-5 min después)', t: 'Veo que tenés problemas con tu (problema), eso suele ser lo más pesado. Vos estás buscando ayuda personalizada para solucionarlo definitivamente y cuanto antes, o simplemente recursos gratuitos? Porque son muy distintos jaja' },
        ] },
    { id: 'inabrible', n: '–', tramo: 'salida', label: 'In-abrible', guion: [],
        ojo: ['No se puede trabajar: perfil privado, ya es alumno, spam o no es médico.'] },
];

const EMBUDO = FASES.filter((f) => f.tramo !== 'salida').map((f) => f.id);

export const faseDe = (id) => FASES.find((f) => f.id === id) || FASES[0];
export const corto = (f) => f.corto || f.label;
export const colorDe = (f) => TRAMOS[f.tramo].color;
export const ordenDe = (id) => EMBUDO.indexOf(id);
/** La que sigue en el embudo, o null en la última y en las salidas. */
export const siguiente = (id) => { const i = EMBUDO.indexOf(id); return i >= 0 && i < EMBUDO.length - 1 ? faseDe(EMBUDO[i + 1]) : null; };

/** El texto del guión con lo que se sabe del lead: su nombre de pila. Lo que no se sabe queda entre paréntesis. */
export function completar(texto, contacto) {
    const nombre = String(contacto?.variables?.nombre || contacto?.nombre || '').trim().split(/\s+/)[0];
    return nombre ? texto.split('(NOMBRE)').join(nombre) : texto;
}
