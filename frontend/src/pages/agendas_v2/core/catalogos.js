// Catálogos fijos de Agendas 2.0. El backend (app/agendas_v2/) tiene que usar los mismos valores.

export const COLORES = ['azul', 'ambar', 'rosa', 'verde', 'violeta', 'turquesa'];
export const PLANTILLAS_FUNNEL = ['Appointment Setting', 'Workshop', 'VSL', 'Webinar', 'Referidos', 'Reactivación'];

// Zona por defecto del equipo y de los eventos: la misma que asume el backend actual
// (User.timezone y AGENDAS_SOURCE_TZ), para que una hora signifique lo mismo en los dos lados.
export const TZ_DEF = 'America/La_Paz';

export const SECCIONES = [
    // 'eventos' es la sección Funnels (el inicio): el funnel contiene sus agendamientos (eventos).
    // Orden de armado: el equipo (estrategias de closers listos) va antes que los formularios (que
    // segmentan a los leads hacia esas estrategias).
    { id: 'eventos', num: '1', label: 'Funnels', icon: 'funnel' },
    { id: 'team', num: '2', label: 'Team', icon: 'users' },
    { id: 'preguntas', num: '3', label: 'Forms', icon: 'pregunta' },
    { id: 'horas', num: '', label: 'Hours', icon: 'clock' },
    { id: 'estadisticas', num: '4', label: 'Stats', icon: 'chart' },
];

export const TIPOS = [
    { k: 'opciones', n: 'Opción única', ico: 'opciones', ph: '' },
    { k: 'lista', n: 'Desplegable', ico: 'lista', ph: 'Escribí para buscar' },
    { k: 'texto', n: 'Texto corto', ico: 'texto', ph: 'Escribí tu respuesta' },
    { k: 'parrafo', n: 'Párrafo', ico: 'parrafo', ph: 'Escribí tu respuesta' },
];
export const TIPOS_CONTACTO = { telefono: { ph: '' }, email: { ph: 'nombre@correo.com' }, instagram: { ph: 'tu.usuario' } };
export function tipo(k) {
    return TIPOS.find(t => t.k === k) || { k, n: k, ico: 'texto', ph: (TIPOS_CONTACTO[k] || {}).ph || '' };
}
export function conOpciones(k) { return k === 'opciones' || k === 'lista'; }

// Datos de contacto: siempre se piden, en este orden. Solo se elige si son obligatorios. El correo va
// primero: con él se reconoce al lead que ya agendó antes y no se le piden de nuevo sus datos.
export const CONTACTO = [
    { k: 'email', tipo: 'email', n: 'Correo', ico: 'mail', titulo: '¿Cuál es tu correo?', placeholder: 'nombre@correo.com' },
    { k: 'nombre', tipo: 'texto', n: 'Nombre', ico: 'user', titulo: '¿Cómo te llamás?', placeholder: 'Nombre y apellido' },
    { k: 'telefono', tipo: 'telefono', n: 'WhatsApp', ico: 'whatsapp', titulo: '{nombre}, ¿a qué WhatsApp te escribimos?', ayuda: 'Por ahí te confirmamos la llamada.' },
    { k: 'instagram', tipo: 'instagram', n: 'Instagram', ico: 'instagram', titulo: '¿Cuál es tu Instagram?', placeholder: 'tu.usuario' },
];
export const FIN_DEF = { titulo: 'Gracias por tu sinceridad', texto: 'Por ahora no vamos a agendar la sesión. Te mandamos por email la ruta para que sigas avanzando.' };
export const DURACIONES = [15, 30, 45, 60, 90];
export const DIAS = [
    { d: 1, c: 'L', n: 'lunes' }, { d: 2, c: 'M', n: 'martes' }, { d: 3, c: 'M', n: 'miércoles' }, { d: 4, c: 'J', n: 'jueves' },
    { d: 5, c: 'V', n: 'viernes' }, { d: 6, c: 'S', n: 'sábado' }, { d: 0, c: 'D', n: 'domingo' },
];
export const HORAS = (() => {
    const h = [];
    for (let i = 0; i < 24; i++) { const p = (i < 10 ? '0' : '') + i; h.push(p + ':00', p + ':30'); }
    h.push('24:00');
    return h;
})();
export function aMin(h) { const p = String(h).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }

// Las claves quedan por compatibilidad: llenar = Llenar agenda, horario = Máxima disponibilidad,
// repartir = Distribuida (por porcentajes, `pesos` del grupo).
export const ESTRATEGIAS = { llenar: 'Llenar agenda', horario: 'Máxima disponibilidad', repartir: 'Distribuida' };
export const ICO_EST = { llenar: 'rayo', horario: 'clock', repartir: 'users' };
export const COLOR_EST = { llenar: 'var(--brand-secondary)', horario: 'var(--warning)', repartir: 'var(--info)' };
export const MS_U = { min: 60000, h: 3600000, d: 86400000 };

export const PAISES = [
    { c: 'AR', n: 'Argentina', d: '+54', ej: '11 2345 6789', z: [['America/Argentina/Buenos_Aires', 'Argentina', 'hora de Argentina']] },
    { c: 'BO', n: 'Bolivia', d: '+591', ej: '7123 4567', z: [['America/La_Paz', 'Bolivia', 'hora de Bolivia']] },
    { c: 'BR', n: 'Brasil', d: '+55', ej: '11 91234 5678', z: [['America/Sao_Paulo', 'Brasília', 'hora de Brasília'], ['America/Manaus', 'Manaos', 'hora de Manaos'], ['America/Rio_Branco', 'Acre', 'hora de Acre']] },
    { c: 'CL', n: 'Chile', d: '+56', ej: '9 1234 5678', z: [['America/Santiago', 'Chile', 'hora de Chile']] },
    { c: 'CO', n: 'Colombia', d: '+57', ej: '301 234 5678', z: [['America/Bogota', 'Colombia', 'hora de Colombia']] },
    { c: 'CR', n: 'Costa Rica', d: '+506', ej: '8312 3456', z: [['America/Costa_Rica', 'Costa Rica', 'hora de Costa Rica']] },
    { c: 'EC', n: 'Ecuador', d: '+593', ej: '99 123 4567', z: [['America/Guayaquil', 'Ecuador', 'hora de Ecuador']] },
    { c: 'MX', n: 'México', d: '+52', ej: '55 1234 5678', z: [['America/Mexico_City', 'Centro', 'hora del centro de México'], ['America/Cancun', 'Quintana Roo', 'hora de Quintana Roo'], ['America/Mazatlan', 'Pacífico', 'hora del Pacífico mexicano'], ['America/Tijuana', 'Baja California', 'hora de Baja California']] },
    { c: 'PY', n: 'Paraguay', d: '+595', ej: '981 123 456', z: [['America/Asuncion', 'Paraguay', 'hora de Paraguay']] },
    { c: 'PE', n: 'Perú', d: '+51', ej: '912 345 678', z: [['America/Lima', 'Perú', 'hora de Perú']] },
    { c: 'UY', n: 'Uruguay', d: '+598', ej: '94 123 456', z: [['America/Montevideo', 'Uruguay', 'hora de Uruguay']] },
    { c: 'VE', n: 'Venezuela', d: '+58', ej: '412 123 4567', z: [['America/Caracas', 'Venezuela', 'hora de Venezuela']] },
    { c: 'ES', n: 'España', d: '+34', ej: '612 34 56 78', z: [['Europe/Madrid', 'Península', 'hora de España'], ['Atlantic/Canary', 'Canarias', 'hora de Canarias']] },
    { c: 'US', n: 'Estados Unidos', d: '+1', ej: '(201) 555-0123', z: [['America/New_York', 'Este', 'hora del este de EE. UU.'], ['America/Chicago', 'Centro', 'hora del centro de EE. UU.'], ['America/Denver', 'Montaña', 'hora de la montaña de EE. UU.'], ['America/Los_Angeles', 'Pacífico', 'hora del Pacífico de EE. UU.']] },
];
export function paisDe(c) { return PAISES.find(p => p.c === c) || PAISES[1]; }
export const ZONAS = PAISES.flatMap(p => p.z.map(z => ({ tz: z[0], c: p.c, n: p.n + (p.z.length > 1 ? ' · ' + z[1] : '') })));
export function zonaValida(tz) { return ZONAS.some(z => z.tz === tz); }
export function zonaInfo(tz) {
    for (const p of PAISES) for (const z of p.z) if (z[0] === tz) return { c: p.c, corto: z[1], largo: z[2] };
    const ciudad = String(tz).split('/').pop().replace(/_/g, ' ');
    return { c: '', corto: ciudad, largo: 'hora de ' + ciudad };
}
const ALIAS_TZ = {
    'America/Monterrey': 'MX', 'America/Merida': 'MX', 'America/Chihuahua': 'MX', 'America/Hermosillo': 'MX', 'America/Bahia': 'BR', 'America/Fortaleza': 'BR',
    'America/Recife': 'BR', 'America/Belem': 'BR', 'America/Maceio': 'BR', 'America/Cuiaba': 'BR', 'America/Campo_Grande': 'BR', 'America/Porto_Velho': 'BR',
    'America/Phoenix': 'US', 'America/Detroit': 'US',
};
// País y zona del lead a partir de la zona de su navegador. Si no la reconoce, cae en la del equipo.
export function detectarPais(tz) {
    if (tz === undefined) { try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { tz = ''; } }
    const z = ZONAS.find(x => x.tz === tz);
    if (z) return { c: z.c, tz };
    if (/^America\/(Argentina\/|Buenos_Aires)/.test(tz)) return { c: 'AR', tz: 'America/Argentina/Buenos_Aires' };
    if (ALIAS_TZ[tz]) return { c: ALIAS_TZ[tz], tz: paisDe(ALIAS_TZ[tz]).z[0][0] };
    return { c: 'BO', tz: TZ_DEF };
}

// Permisos por rol, agrupados por sección.
export const PERMISOS = [
    { sec: 'forms', n: 'Forms', ico: 'pregunta', items: [['forms.ver', 'Ver formularios'], ['forms.editar', 'Crear y editar preguntas'], ['forms.ruteo', 'Editar el ruteo']] },
    { sec: 'team', n: 'Team', ico: 'users', items: [['team.ver', 'Ver el equipo'], ['team.sumar', 'Sumar personas'], ['team.horarios', 'Cambiar horarios de otros'], ['team.prioridades', 'Editar estrategias']] },
    { sec: 'events', n: 'Events', ico: 'calendar', items: [['events.ver', 'Ver eventos'], ['events.editar', 'Crear y editar eventos'], ['events.publicar', 'Publicar cambios'], ['events.links', 'Crear links']] },
    { sec: 'stats', n: 'Stats', ico: 'chart', items: [['stats.ver', 'Ver estadísticas']] },
    { sec: 'conf', n: 'Configuración', ico: 'ajustes', items: [['conf.miembros', 'Miembros y roles'], ['conf.funnels', 'Funnels'], ['conf.integraciones', 'Integraciones']] },
];
export const PERM_KEYS = PERMISOS.flatMap(g => g.items.map(i => i[0]));
export const PERM_VIEJOS = {
    preguntas: ['forms.ver', 'forms.editar', 'forms.ruteo'], team: ['team.ver', 'team.sumar', 'team.horarios', 'team.prioridades'],
    eventos: ['events.ver', 'events.editar', 'events.publicar', 'events.links'], estadisticas: ['stats.ver'],
    configuracion: ['conf.miembros', 'conf.funnels', 'conf.integraciones'],
};
export const ICONOS_ROL = [['estrella', 'Estrella'], ['chart', 'Gráfico'], ['whatsapp', 'Mensaje'], ['rayo', 'Rayo'], ['user', 'Persona'], ['users', 'Equipo'], ['calendar', 'Agenda'], ['funnel', 'Funnel'], ['ajustes', 'Engranaje'], ['fuego', 'Fuego']];
export function icoNombre(n) {
    n = String(n || '').toLowerCase();
    return /ceo|chief exec/.test(n) ? 'estrella' : /director|sales officer|cso/.test(n) ? 'chart' : /setter/.test(n) ? 'rayo' : /closer/.test(n) ? 'whatsapp' : 'user';
}
// Accesos que trae un rol nuevo según su nombre.
export function accesosPorNombre(nombre) {
    const n = String(nombre || '').toLowerCase();
    if (/ceo|director|chief/.test(n)) return { accesos: PERM_KEYS.slice(), atiende: false };
    if (/closer/.test(n)) return { accesos: ['team.ver', 'events.ver', 'stats.ver'], atiende: true };
    if (/setter/.test(n)) return { accesos: ['events.ver', 'events.links', 'stats.ver'], atiende: false };
    return { accesos: ['stats.ver'], atiende: false };
}
export const INTEG_DEF = {
    gcal: { activo: false, crear: true, ocupado: true },
    meet: { activo: false, link: true },
    pixel: { activo: false, id: '', lead: true, schedule: true, nocalifica: false },
    meta: { activo: false, dataset: '', capi: true },
};
