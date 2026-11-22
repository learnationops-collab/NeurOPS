// El documento de setting como lo cargaría la Guía: etapa → pasos → opciones (A, B… o una por respuesta).
// `uso`: «solo si …», «opcional» o «no se usa». `r`: cifras de ejemplo (enviados, % que respondió).
const TRAMOS = { auto: { n: 'Automática', c: 'var(--info)' }, manual: { n: 'Manual', c: 'var(--manual)' },
  agenda: { n: 'Agendamiento', c: 'var(--warn)' }, salida: { n: 'Sale del embudo', c: 'var(--err)' } };

const QUIEN = {
  leads: ['Médicos graduados que buscan pasar su examen de residencia', 'Residentes o especialistas que buscan pasar un examen muy importante'],
  noleads: ['Estudiantes', 'Internado', 'Otra carrera', 'Servicio social o rural'],
  excepcion: 'Si buscan ayuda personalizada se los prospecta igual: se les pregunta en qué carrera y etapa están y se sigue la estructura normal.',
};

const ETAPAS = [
  { id: 'apertura', n: 1, tramo: 'auto', label: 'Apertura', bot: 'Lead Magnet', pasos: [
    { t: 'Apertura', atajo: 'apertura', avanza: true, op: [{ x: 'Genial, ya te lo mando 🙌\n\nAntes, para qué examen te estás preparando: ENARM, MIR, STEP, EUNACOM, Universidades de Colombia o cuál?' }] }] },
  { id: 'conexion', n: 2, tramo: 'manual', label: 'Conexión y situación actual', pasos: [
    { t: 'Fecha del examen', atajo: 'fecha', op: [
      { x: 'Perfecto, y para cuándo te estarás presentando, más o menos?\n\nPara ver cuál es la guía que más se adapte a tu caso', r: [64, 81] },
      { x: 'Ahh genial, te presentarás en este año o apuntás al próximo año?\n\nPara ver cuál es la guía que más se adapte a tu caso', r: [41, 78] }] },
    { t: 'Servicio', atajo: 'servicio', uso: 'solo si', cuando: 'ENARM, el próximo año', nota: 'Si ya lo terminó, seguí. Si sigue en su servicio, pasalo a No lead.', op: [
      { x: 'Estás en tu servicio aún o ya lo has terminado?' }] },
    { t: 'MIR 2028', atajo: 'mir', uso: 'solo si', cuando: 'MIR 2028', op: [
      { x: 'Ahhh falta, pero ya iniciaste a prepararte o estás en cero todavía?' }] },
    { t: 'Método', atajo: 'metodo', avanza: true, op: [
      { x: 'Hoy ya venís estudiando con algún método o academia, o estás medio a la deriva con eso?\n\nAsí podés aplicarla con el material correcto' },
      { x: 'Solés estudiar con algún método o academia, o estás medio a la deriva con eso?\n\nAsí podés aplicarla con el material correcto' }] },
    { t: 'Puntaje', atajo: 'puntaje', uso: 'opcional', op: [
      { x: 'Cómo venís con el puntaje hoy, cuál es tu puntaje actual?\n\nY sabés cuánto necesitás para entrar a la especialidad que querés?' }] },
    { t: 'Inversión', atajo: 'inversion', uso: 'no se usa', op: [
      { x: 'Y en qué venís invirtiendo para prepararte hasta ahora: academia, banco, algún curso?' }] }] },
  { id: 'dolor', n: 3, tramo: 'manual', label: 'Dolor', nota: 'Si no menciona ninguna dificultad, ponele la etiqueta: procrastinación, retención, concentración u organización.', pasos: [
    { t: 'Dificultades', atajo: 'dificultades', op: [
      { x: 'Contame, qué dificultades estás teniendo en tu preparación? O si no tenés ninguna dificultad, qué es lo que más te gustaría mejorar urgentemente', r: [212, 49] },
      { x: 'Contame, qué puntos te gustaría mejorar de tu metodología de estudio?', r: [96, 58], desde: '29/10' }] },
    { t: 'Si está en cero', atajo: 'cero', uso: 'solo si', cuando: 'todavía no empezó a estudiar', op: [
      { x: 'Y qué sentís o creés que es lo que más te puede dificultar en tu preparación?\n\nO si no tenés ninguna dificultad, qué es lo que más te gustaría mejorar de tu metodología de estudio' }] },
    { t: 'Profundizar', atajo: 'profundizar', op: [
      { audio: 'Audio de Mario: profundizar', x: 'Contame un poco cómo vivís en tu día a día esta falta de [problema], cómo lo experimentás o cómo te afecta?\n\nPodés extenderte todo lo que necesites, así puedo orientarte mejor' }] },
    { t: 'Ya invirtió', atajo: 'invirtio', uso: 'solo si', cuando: 'ya invirtió en academias o material y hay poco dolor', op: [
      { x: 'O sea que ya invertiste dinero en material, academias y aun así no lográs superar [problema]... Ese es justo el punto {nombre}, el problema nunca fue el material sino cómo lo aprovechás, lo veo muy seguido!' }] },
    { t: 'Tiempo', atajo: 'tiempo', avanza: true, op: [{ x: 'Hace cuánto te viene pasando esto?' }] }] },
  { id: 'consecuencia', n: 4, tramo: 'manual', label: 'Consecuencia y urgencia', pasos: [
    { t: 'Consecuencia', atajo: 'consecuencia', avanza: true, op: [
      { x: 'Sentís que si mejorás esos puntos podrías tener un mejor rendimiento en tu preparación?' },
      { x: 'Che, y sentís que si seguís igual vas a poder alcanzar el puntaje para la especialidad que deseás o necesitás hacer algunos ajustes?' }] }] },
  { id: 'compromiso', n: 5, tramo: 'manual', label: 'Compromiso', pasos: [
    { t: 'Compromiso', atajo: 'compromiso', avanza: true, op: [
      { x: '{nombre}, entonces para entenderte mejor y ver qué puedo recomendarte\n\nEsto es una prioridad que querés resolver ahora cuanto antes, o quizás hay otras prioridades hoy día y es algo más de «bueno, en algún momento veré de solucionarlo»?' },
      { x: 'Sentís que llegarías con la preparación necesaria para alcanzar el puntaje que necesitás, o ves que hoy esto es algo que necesitás priorizar y ajustar?' }] }] },
  { id: 'propuesta', n: 6, tramo: 'manual', label: 'Propuesta de agenda', pasos: [
    { t: 'Primera parte', atajo: 'oferta', op: [
      { x: 'Ahh ok, estás comprometido con conseguirlo digamos\n\nMirá, te cuento qué sucede entonces\n\nEn estos 3 años ayudando a médicos me di cuenta que casi nadie tiene diagnóstico correcto de sus problemas de preparación, ni un plan basado en ciencia de cómo solucionarlos 🤷🏻‍♂️\n\nEl primer paso es saber las causas de [problema] y cuál es el mejor sistema adaptado a vos, para que logres no solo [resultado deseado] sino que tu puntaje suba\n\nJusto por eso te quería proponer algo', r: [57, 72] },
      { x: 'Bien, te cuento entonces\n\nEn estos 3 años ayudando a médicos me di cuenta que todos se saltan el primer paso 🤷🏻‍♂️\n\nAntes de ir por academias o cursos, tenés que saber qué está causando [problema] y cuál es el sistema de aprendizaje que más se adapta a vos, para que logres subir tus scores semana a semana sin estancarte por [problema]\n\nSiento que te pasa lo mismo y justo por eso te quería proponer algo', r: [33, 64] }] },
    { t: 'Ejemplo de un médico', atajo: 'ejemplo', uso: 'opcional', op: [
      { x: 'Como por ejemplo [médico con la misma dificultad] que venía justo como vos, con [problemas del lead], y en 3 semanas pasó de 50% a 73% en simulacros' },
      { x: 'Como por ejemplo [médico], un médico que venía justo como vos y en 3 semanas pasó de 50% a 73% en simulacros' }] },
    { t: 'Segunda parte', atajo: 'cupo', avanza: true, op: [
      { x: 'Mirá, esta semana estamos dando algunas consultorías gratuitas\n\nEn el diagnóstico vemos tu examen, la causa de tus desafíos principales, identificamos tu forma de aprendizaje y te damos algunas recomendaciones, te sirve si armamos un diagnóstico de tu caso?\n\nSi te gustaría trabajarlo con nosotros la puerta está abierta y si no por lo menos tenés una guía clara de por qué [problema] y cómo trabajarlo\n\nQuerés aprovechar un cupo free?', r: [61, 44] }] }],
    anteriores: [{ t: 'Oferta de mayo', periodo: '15/05 al 31/05' }] },
  { id: 'link', n: 7, tramo: 'agenda', label: 'Link', pasos: [
    { t: 'Link', atajo: 'link', op: [
      { x: 'Bien, acá te paso el link para que puedas agendar tu cupo\n\n{link de agenda}\n\nEs importante que agendes en un espacio que no te choque con el trabajo u otra actividad, para que podamos hacer un buen diagnóstico, si no conseguís uno avisame y te doy una mano\n\nMe quedo por acá hasta que logres reservar, confirmame cuando esté por favor', r: [38, 66] }] },
    { t: 'No tiene horarios', atajo: 'sinhorario', uso: 'solo si', cuando: 'ningún horario le sirve', nota: 'Definí opciones con él, consultá a los closers y agendalo en cualquier horario: el closer lo mueve.', op: [
      { x: 'En qué días y horarios podrías? Así lo veo con el equipo y te guardo un lugar' }] }] },
  { id: 'confirmacion', n: 8, tramo: 'agenda', label: 'Confirmación', pasos: [
    { t: 'Agendó', atajo: 'agendo', op: [
      { x: '{nombre}, ahí vi que agendaste!\n\nA la brevedad mi equipo ya te va a escribir por WhatsApp para terminar de confirmar tu sesión y que la puedas aprovechar\n\nEstate atento al WhatsApp porfa!\n\nPor cierto, cuando puedas revisá estos videos, son de preparación para que estés ready para tu sesión https://work.thelearnation.com/agendas-v2/agenda/gracias/dn8r3h65btk' }] },
    { t: 'Fin del día', atajo: 'findia', uso: 'solo si', cuando: 'termina el día y tiene agenda hoy', op: [
      { x: '{nombre}, recién me libero de unas consultorías, te pudiste contactar con Darían para confirmar tu sesión?' }] }] },
  { id: 'nolead', n: 'x', tramo: 'salida', label: 'No lead', bot: 'No lead', nota: 'Lo manda el bot. Si no salió, mandalo a mano desde el paso 1. Después del paso 3 sigue el setter.', pasos: [
    { t: 'Problema', atajo: 'nl-problema', botones: ['Retención', 'Procrastinación', 'Puntaje'], op: [
      { x: 'Entiendo, en ese caso contame, qué dificultades estás teniendo en tu preparación y necesitás mejorar de tus métodos?' }] },
    { t: 'Recurso', atajo: 'nl-recurso', porRespuesta: true, op: [
      { si: 'Retención', x: 'Entiendo! Te paso por acá una clase donde explico cómo he ayudado a médicos a solucionar ese problema y al final de la clase te dejo herramientas que podés aplicar en tu estudio\n\nhttps://youtu.be/xGHBdIOGcgQ' },
      { si: 'Procrastinación', x: 'Entiendo! Te paso por acá una clase donde explico cómo he ayudado a médicos a solucionar ese problema y al final de la clase te dejo herramientas que podés aplicar en tu estudio\n\nhttps://youtu.be/dB41AQ3wZJU' },
      { si: 'Puntaje', x: 'Entiendo! Te paso por acá una clase donde explico cómo he ayudado a médicos a solucionar ese problema y al final de la clase te dejo herramientas que podés aplicar en tu estudio\n\nhttps://youtu.be/ey-aaRJwDS4' }] },
    { t: 'Ayuda personalizada', atajo: 'nl-audio', espera: 'de 3 a 5 minutos después del recurso', op: [
      { audio: 'Audio de Mario (el real)', x: 'Veo que tenés problemas con tu [problema], eso suele ser lo más pesado\n\nVos estás buscando ayuda personalizada para solucionarlo definitivamente y cuanto antes? O simplemente recursos gratuitos?\n\nPorque son muy distintos jaja' }] }] },
  { id: 'inabrible', n: '-', tramo: 'salida', label: 'In-abrible', nota: 'No se puede trabajar: perfil privado, ya es alumno, spam o no es médico.', pasos: [] },
];
