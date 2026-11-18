// Datos de mentira del chat cruzado. Nada llama a un servidor.
// «donde» = el servicio que la persona usó en los últimos 5 minutos (null = desconectada).

const PRODUCTOS = {
  work: { nombre: 'Work', letra: 'W' },
  academy: { nombre: 'Academy', letra: 'A' },
  leadership: { nombre: 'Leadership', letra: 'L' },
};

const PERSONAS = {
  santi:  { nombre: 'Santiago', rol: 'Operador', area: 'desarrollo', donde: 'work', color: '#5B7CFF' },
  mario:  { nombre: 'Mario', rol: 'Admin', area: 'todas', donde: 'leadership', color: '#FF3FA4' },
  kerwin: { nombre: 'Kerwin', rol: 'Director comercial', area: 'ventas', donde: 'leadership', color: '#D9A441' },
  vale:   { nombre: 'Valentina', rol: 'Closer', area: 'ventas', donde: 'work', estado: 'En llamada · hasta 16:30', color: '#2FBF8F' },
  elias:  { nombre: 'Elias', rol: 'Setter', area: 'ventas', donde: 'work', color: '#E85C4A' },
  paula:  { nombre: 'Paula', rol: 'Setter', area: 'ventas', donde: null, visto: 'hace 25 min', color: '#9B6BFF' },
  andres: { nombre: 'Andrés', rol: 'CES', area: 'fulfillment', donde: 'academy', color: '#22D3EE' },
  camila: { nombre: 'Camila', rol: 'Consultora', area: 'fulfillment', donde: 'academy', estado: 'En sesión con Lucía R.', color: '#F472B6' },
  joaco:  { nombre: 'Joaquín', rol: 'Rendimiento', area: 'fulfillment', donde: null, visto: 'ayer', color: '#7F8CA8' },
};

// Quién mira el mockup: cambia los canales que ve (roles, como en la Academia).
const VISORES = {
  santi: { areas: ['general', 'ventas', 'fulfillment', 'desarrollo'], bugs: 'gestiona' },
  vale: { areas: ['general', 'ventas', 'fulfillment'], bugs: 'reporta' },
  andres: { areas: ['general', 'fulfillment'], bugs: 'reporta' },
};

const AREAS = [
  { id: 'general', nombre: 'General', icono: 'hash', suelta: true },
  { id: 'ventas', nombre: 'Ventas', icono: 'maletin' },
  { id: 'fulfillment', nombre: 'Fulfillment', icono: 'birrete' },
  { id: 'desarrollo', nombre: 'Desarrollo', icono: 'codigo' },
];

const CANALES = {
  equipo: { area: 'general', nombre: 'Equipo', desc: 'La charla de todo el equipo, en los tres servicios', nuevos: 3 },
  ventas: { area: 'ventas', nombre: 'Ventas', desc: 'Closers, setters y dirección comercial', nuevos: 2 },
  agendasVenta: { area: 'ventas', nombre: 'Agendas de venta', desc: 'Avisos de Work y la charla de cada lead', nuevos: 4 },
  wins: { area: 'ventas', nombre: 'Wins', desc: 'Cada venta, con su tarjeta', nuevos: 1 },
  fulfillment: { area: 'fulfillment', nombre: 'Fulfillment', desc: 'Coordinación del equipo de alumnos' },
  onboarding: { area: 'fulfillment', nombre: 'Onboarding', desc: 'La bitácora de los alumnos nuevos', nuevos: 2 },
  agendas: { area: 'fulfillment', nombre: 'Agendas', desc: 'Resultado de cada llamada' },
  desarrollo: { area: 'desarrollo', nombre: 'Desarrollo', desc: 'Work, Academy y Leadership', nuevos: 1 },
};

const BUGS = [
  { id: 'b1', titulo: 'El reporte de setter no carga los follow-ups', de: 'elias', estado: 'Espera respuesta', desde: 'work' },
  { id: 'b2', titulo: 'No se ve el botón de la sesión de onboarding', de: 'andres', estado: 'Resuelto, espera confirmación', desde: 'academy' },
];

const DIRECTAS = [
  { id: 'dm-mario', con: 'mario', ultimo: '¿Vemos lo del chat a las 17?', nuevos: 1 },
  { id: 'dm-kerwin', con: 'kerwin', ultimo: 'Te dejé la tarea en Leadership' },
];

// Tipos: texto · aviso (tarjeta de un sistema, ámbar) · bitacora (celeste) · tarea (Leadership) · learnito
const MENSAJES = {
  equipo: [
    { tipo: 'texto', de: 'mario', desde: 'leadership', hora: '09:12', texto: 'Buen día equipo. Hoy cerramos la semana de Momentum, cualquier cosa por acá.', reacciones: { llama: 6, corazon: 2 } },
    { tipo: 'texto', de: 'andres', desde: 'academy', hora: '09:20', texto: '¡Vamos! Tres onboardings agendados para hoy.' },
    { tipo: 'texto', de: 'elias', desde: 'work', hora: '10:02', texto: '@Learnito ¿cuántas agendas nuevas entraron esta semana contra la pasada?' },
    { tipo: 'learnito', pidio: 'elias', hora: '10:02', texto: 'Esta semana van **41 agendas**, 9 más que la pasada a esta altura (+28%). La subida viene casi toda de Instagram.', grafico: [['Semana pasada', 32], ['Esta semana', 41]], chips: ['Por fuente', 'Por closer'] },
    { tipo: 'texto', de: 'kerwin', desde: 'leadership', hora: '10:15', texto: 'Buenísimo. @Valentina después de la llamada pasame cómo viene el show up.', reacciones: { pulgar: 2 } },
  ],
  ventas: [
    { tipo: 'texto', de: 'kerwin', desde: 'leadership', hora: '08:40', texto: 'Meta de la semana: 12 ventas. Vamos 7.', reacciones: { musculo: 4 } },
    { tipo: 'tarea', de: 'kerwin', hora: '08:41', titulo: 'Revisar los follow-ups sin responder de más de 48 h', asignada: 'elias', vence: 'Hoy', origen: 'Reunión de resultados · lunes 16/11' },
    { tipo: 'texto', de: 'elias', desde: 'work', hora: '09:05', texto: 'Ya arranco con eso, son 14.', respondeA: 'tarea' },
  ],
  agendasVenta: [
    { tipo: 'aviso', sistema: 'Work', hora: '11:04', titulo: 'Nueva agenda', nombre: 'Martín Ferreyra', tel: '+54 9 11 5555-0192', chips: ['Instagram', 'Palabra: MEDICO'], cajas: [['Closer', '@Valentina'], ['Hora', 'Hoy 15:00']] },
    { tipo: 'texto', de: 'vale', desde: 'work', hora: '11:10', texto: 'Lo tomo. Ya le escribí por WhatsApp.', respondeA: 'aviso' },
    { tipo: 'aviso', sistema: 'Work', hora: '12:31', titulo: 'No terminó de agendar', nombre: 'Sofía Paz', tel: '+57 300 555 0144', chips: ['Formulario', 'Abandonó en el horario'], cajas: [['Setter', '@Paula']] },
  ],
  wins: [
    { tipo: 'aviso', sistema: 'Work', hora: '13:02', tono: 'exito', titulo: 'Venta', nombre: 'Lucía Romero', chips: ['Residency Roadmap', '4 meses'], cajas: [['Closer', '@Valentina'], ['Monto', 'USD 1.800']], reacciones: { llama: 9, corazon: 4, musculo: 3 } },
    { tipo: 'texto', de: 'mario', desde: 'leadership', hora: '13:05', texto: '¡Vamos Vale! 🔥 Primera del día.', respondeA: 'aviso' },
  ],
  fulfillment: [
    { tipo: 'texto', de: 'camila', desde: 'academy', hora: '10:30', texto: '¿Alguien sabe si Lucía Romero ya tiene acceso? Tengo la sesión a las 15.' },
    { tipo: 'texto', de: 'andres', desde: 'academy', hora: '10:33', texto: 'Se lo doy ahora, la venta entró recién por Work.' },
  ],
  onboarding: [
    { tipo: 'bitacora', hora: '13:03', titulo: 'Alumno nuevo', nombre: 'Lucía Romero', detalle: 'Residency Roadmap · seña completada · viene de Work' },
    { tipo: 'bitacora', hora: '14:10', titulo: 'Onboarding Session agendada', nombre: 'Lucía Romero', detalle: 'Mañana 11:00 · con @Camila' },
    { tipo: 'texto', de: 'andres', desde: 'academy', hora: '14:12', texto: 'Acceso dado ✔', reacciones: { check: 2 } },
  ],
  agendas: [
    { tipo: 'aviso', sistema: 'Work', hora: '16:35', titulo: 'Resultado de llamada', nombre: 'Martín Ferreyra', chips: ['Seguimiento'], cajas: [['Closer', '@Valentina'], ['Próximo paso', 'Llamar el jueves']] },
  ],
  desarrollo: [
    { tipo: 'texto', de: 'santi', desde: 'work', hora: '09:40', texto: 'Subí la Configuración flotante a main (ADR-W169).', reacciones: { pulgar: 2 } },
    { tipo: 'tarea', de: 'mario', hora: '09:55', titulo: 'Mockup del chat cruzado Work · Academy · Leadership', asignada: 'santi', vence: 'Viernes', origen: 'Reunión de estrategia · lunes 16/11' },
    { tipo: 'texto', de: 'mario', desde: 'leadership', hora: '09:56', texto: 'Que se vea quién está conectado y desde dónde.', respondeA: 'tarea' },
  ],
  'dm-mario': [
    { tipo: 'texto', de: 'mario', desde: 'leadership', hora: '15:20', texto: '¿Vemos lo del chat a las 17?' },
  ],
  'dm-kerwin': [
    { tipo: 'texto', de: 'kerwin', desde: 'leadership', hora: '11:00', texto: 'Te dejé la tarea en Leadership' },
  ],
  learnito: [],
  b1: [
    { tipo: 'texto', de: 'elias', desde: 'work', hora: '08:50', texto: 'Abro el reporte de setter y los follow-ups quedan en 0. Ayer andaba.' },
  ],
  b2: [
    { tipo: 'texto', de: 'andres', desde: 'academy', hora: 'Ayer', texto: 'En la ficha de Lucía no aparece el botón de la Onboarding Session.' },
    { tipo: 'texto', de: 'santi', desde: 'work', hora: '09:10', texto: 'Arreglado, era el permiso del rol CES. ¿Lo ves ahora?' },
  ],
};
