// Datos de mentira del mockup de Configuración unificada (Work, Academy y Leadership).

const P = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  swatch: '<path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-3.5 3H16a2 2 0 0 0-1.4 3.4A2 2 0 0 1 12 22z"/><circle cx="7.5" cy="10.5" r="1.2"/><circle cx="12" cy="7" r="1.2"/><circle cx="16.5" cy="10.5" r="1.2"/>',
  dock: '<rect x="3" y="15" width="18" height="6" rx="2"/><path d="M7 18h.01M12 18h.01M17 18h.01M5 3h14v8H5z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14 9l2 2"/>',
  bug: '<path d="M8 2l1.9 1.9M16 2l-1.9 1.9M9 7.1V6a3 3 0 0 1 6 0v1.1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zM12 20v-9M6.5 13H3M21 13h-3.5M6 9 3 7M18 9l3-2M6 17l-3 2M18 17l3 2"/>',
  grad: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.2a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 17-.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  portal: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17.5h7M17.5 14v7"/>',
};
const ico = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

// Las secciones de Configuración. `para`: qué perfiles la ven. `grupo` ordena las pestañas laterales.
const SECCIONES = [
  { key: 'cuenta', label: 'Tu cuenta', desc: 'Nombre, contacto, zona horaria y personaje', icon: 'user', grupo: 'Vos', para: 'todos' },
  { key: 'apariencia', label: 'Apariencia', desc: 'Tema, modo, efectos y cómo se acomoda la pantalla', icon: 'swatch', grupo: 'Vos', para: 'todos' },
  { key: 'dock', label: 'Dock', desc: 'Abajo o barra lateral, auto-ocultar, celular', icon: 'dock', grupo: 'Vos', para: 'todos' },
  { key: 'notificaciones', label: 'Notificaciones', desc: 'Qué te avisa y por dónde', icon: 'bell', grupo: 'Vos', para: 'todos' },
  { key: 'disponibilidad', label: 'Disponibilidad', desc: 'Tus horarios para recibir agendas', icon: 'clock', grupo: 'Trabajo', para: ['closer', 'admin', 'consultor'] },
  { key: 'integraciones', label: 'Integraciones', desc: 'Google Calendar y WhatsApp', icon: 'plug', grupo: 'Trabajo', para: ['closer', 'admin', 'consultor'] },
  { key: 'eventos', label: 'Mis eventos', desc: 'Tus links de agendamiento', icon: 'calendar', grupo: 'Trabajo', para: ['closer'] },
  { key: 'examen', label: 'Tu examen', desc: 'La fecha y el programa que preparás', icon: 'grad', grupo: 'Trabajo', para: ['alumno'] },
  { key: 'equipo', label: 'Equipo', desc: 'Altas, roles y accesos', icon: 'users', grupo: 'Trabajo', para: ['admin', 'leadership'] },
  { key: 'seguridad', label: 'Seguridad', desc: 'Contraseña, dos pasos y sesiones abiertas', icon: 'key', grupo: 'Cuenta', para: 'todos' },
  { key: 'ayuda', label: 'Ayuda', desc: 'Reportar un problema y tus reportes', icon: 'bug', grupo: 'Cuenta', para: 'todos' },
];

const PERFILES = {
  setter: { nombre: 'Work · Setter', usuario: 'Elias Ruiz', inicial: 'E', rol: 'Setter', email: 'elias@learnation.test', tel: '+54 11 5555 1234', tz: 'AR', notis: 4, portal: true },
  closer: { nombre: 'Work · Closer', usuario: 'Marlon Pérez', inicial: 'M', rol: 'Closer', email: 'marlon@learnation.test', tel: '+57 300 555 0101', tz: 'CO', notis: 2, portal: true, calendar: true, whatsapp: false },
  admin: { nombre: 'Work · Admin', usuario: 'Santi', inicial: 'S', rol: 'Administración', email: 'santi@learnation.test', tel: '+54 11 5555 9876', tz: 'AR', notis: 12, portal: true, calendar: true, whatsapp: true },
  consultor: { nombre: 'Academy · Consultora', usuario: 'Belu Gómez', inicial: 'B', rol: 'Consultora', email: 'belu@learnation.test', tel: '+34 600 555 222', tz: 'ES', notis: 5, portal: true, calendar: false, whatsapp: true },
  alumno: { nombre: 'Academy · Alumno', usuario: 'Sofía Díaz', inicial: 'S', rol: 'Ace Learners', email: 'sofia@correo.test', tel: '', tz: 'MX', notis: 1, portal: false },
  leadership: { nombre: 'Leadership · Miembro', usuario: 'Santi', inicial: 'S', rol: 'Dirección', email: 'santi@learnation.test', tel: '+54 11 5555 9876', tz: 'AR', notis: 7, portal: true },
};

// Los temas únicos (temas.css del mockup del dock): de dónde sale cada uno.
const TEMAS = [
  { key: 'learnation', label: 'Learnation', desc: 'Navy y magenta, con aura' },
  { key: 'solido', label: 'Sólido', desc: 'Pizarra, sin vidrio' },
  { key: 'relampago', label: 'Relámpago', desc: 'Índigo y cian' },
  { key: 'puro', label: 'Puro', desc: 'Negro y blanco, máximo contraste' },
];

const seccionesDe = (perfil) => SECCIONES.filter((s) => s.para === 'todos' || s.para.includes(perfil));
