import { BarChart3, Briefcase, CalendarDays } from 'lucide-react';

// Áreas: un mismo rol trabaja en más de una pantalla, cada una con su dock. Cada área es una tarjeta
// del Portal (utils/portal.js), junto a los demás roles de la persona. Por ahora la dirección comercial
// y admin (que además tiene la suya):
//   Administración  las páginas del admin (ventas, payroll, formularios, agendas…).
//   Dirección     el dashboard comercial (analizar, revisar, reportar).
//   Agendamiento  Agendas 2.0 / Thalamus (formularios, equipo, eventos de agenda).

export const AREAS = {
    administracion: { id: 'administracion', label: 'Administración', ruta: '/admin/ventas', Icono: Briefcase },
    direccion: { id: 'direccion', label: 'Dirección', ruta: '/admin/comercial', Icono: BarChart3 },
    agendamiento: { id: 'agendamiento', label: 'Agendamiento', ruta: '/agendas-v2', Icono: CalendarDays },
};

const AREAS_POR_ROL = {
    director_comercial: ['direccion', 'agendamiento'],
    admin: ['administracion', 'direccion', 'agendamiento'],
};

export const areasDe = (rol) => (AREAS_POR_ROL[rol] || []).map((id) => AREAS[id]);
