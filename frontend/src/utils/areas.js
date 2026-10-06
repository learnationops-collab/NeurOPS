import { LayoutGrid } from 'lucide-react';

// Áreas: un mismo rol trabaja en más de una pantalla, cada una con su dock. Se entra siempre a la
// primera (la de roleLanding.js) y se pasa a las otras desde el menú de sesión del dock, con
// «Cambiar de área». Por ahora solo la dirección comercial (y admin, que entra a las dos):
//   Dirección     el dashboard comercial (analizar, revisar, reportar).
//   Agendamiento  Agendas 2.0 / Thalamus (formularios, equipo, eventos de agenda).

export const AREAS = {
    direccion: { id: 'direccion', label: 'Dirección', ruta: '/admin/comercial' },
    agendamiento: { id: 'agendamiento', label: 'Agendamiento', ruta: '/agendas-v2' },
};

const AREAS_POR_ROL = {
    director_comercial: ['direccion', 'agendamiento'],
    admin: ['direccion', 'agendamiento'],
};

export const areasDe = (rol) => (AREAS_POR_ROL[rol] || []).map((id) => AREAS[id]);

/**
 * La opción «Cambiar de área» para los `grupos` de MenuSesion: abre un panel con las otras áreas
 * del rol. Lista vacía si el rol tiene una sola (o está simulando a otro), así que se puede poner
 * siempre.
 */
export const opcionCambiarDeArea = (user, actual, navigate) => {
    if (!user || user.is_impersonating) return [];
    const otras = areasDe(user.role).filter((a) => a.id !== actual);
    if (!otras.length) return [];
    return [{
        id: 'area', label: 'Cambiar de área', Icono: LayoutGrid,
        panel: {
            titulo: 'Cambiar de área',
            vacio: 'No hay otras áreas.',
            cargar: () => otras.map((a) => ({ id: a.id, label: a.label, onClick: () => navigate(a.ruta) })),
        },
    }];
};
