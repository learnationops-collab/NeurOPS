import { BarChart3, Briefcase, CalendarDays, LayoutGrid } from 'lucide-react';
import { roleLandingPath } from './roleLanding';

// Áreas: un mismo rol trabaja en más de una pantalla, cada una con su dock. La entrada es
// login → rol (si tiene más de uno) → área (si el rol tiene más de una): en /inicio se elige el área,
// y con «Entrar directo» la próxima vez se saltea la elección. Desde el menú de sesión del dock,
// «Cambiar de área» vuelve a /inicio. Por ahora la dirección comercial y admin (que además tiene la suya):
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

// La pantalla para elegir el área. ?elegir=1: se muestra aunque haya un área por defecto.
export const RUTA_ELEGIR_AREA = '/inicio';

// El área por defecto es de cada cuenta y rol, en este navegador (como el tema).
const claveDefecto = (user) => `area_por_defecto_${user.id}_${user.role}`;

export const areaPorDefecto = (user) => {
    if (!user) return null;
    try {
        const id = localStorage.getItem(claveDefecto(user));
        return areasDe(user.role).some((a) => a.id === id) ? id : null;
    } catch {
        return null;
    }
};

export const fijarAreaPorDefecto = (user, id) => {
    try {
        if (id) localStorage.setItem(claveDefecto(user), id);
        else localStorage.removeItem(claveDefecto(user));
    } catch { /* sin storage: se elige cada vez */ }
};

/** A dónde va al entrar con ese rol: su área por defecto, la elección de área o su pantalla. */
export const destinoDeEntrada = (user) => {
    if (!user) return '/login';
    if (areasDe(user.role).length < 2 || user.is_impersonating) return roleLandingPath(user.role);
    const def = areaPorDefecto(user);
    return def ? AREAS[def].ruta : RUTA_ELEGIR_AREA;
};

/**
 * La opción «Cambiar de área» para los `grupos` de MenuSesion: lleva a la elección de área. Lista
 * vacía si el rol tiene una sola (o está simulando a otro), así que se puede poner siempre.
 * `actual` queda por compatibilidad con los que la llaman.
 */
// eslint-disable-next-line no-unused-vars
export const opcionCambiarDeArea = (user, actual, navigate) => {
    if (!user || user.is_impersonating || areasDe(user.role).length < 2) return [];
    return [{
        id: 'area', label: 'Cambiar de área', Icono: LayoutGrid,
        onClick: () => navigate(RUTA_ELEGIR_AREA + '?elegir=1'),
    }];
};
