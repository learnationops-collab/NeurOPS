// El menú de sesión (el desplegable al lado del dock, pages/comercial/components/MenuSesion.jsx) con
// los mismos grupos, en el mismo orden y con los mismos nombres en todas las pantallas. Cada pantalla
// aporta solo lo suyo: sus acciones de trabajo y, si corresponde, a dónde más puede ir.
//
//   [Acciones de esta pantalla]  Nueva agenda, Referido, Mis links... (opcional)
//   [Mi cuenta]                  Configuración · Playbook
//   [Ir a]                       Cambiar de área · Cambiar de vista/rol · Finances
//   [Equipo]                     Simular a un closer / a un setter (quien puede)
//   [Ayuda]                      Reportar un problema · Mis reportes (lo agrega MenuSesion solo)
//   [Salida]                     Volver a mi sesión · Cerrar sesión
import toast from 'react-hot-toast';
import { Compass, Ghost, LogOut, Settings, VenetianMask } from 'lucide-react';
import api from '../services/api';
import { opcionCambiarDeArea } from '../utils/areas';
import { opcionesDeRol, rotuloDeRol } from '../utils/cuentasVinculadas';
import { revertImpersonation, simularA } from '../utils/impersonation';

/**
 * Quién ve "Simular a un closer" y "a un setter": lo decide el backend (`/auth/impersonate`), esto
 * solo evita ofrecerle la opción a quien recibiría un 403. Se mira el rol REAL: simulando a un
 * closer, la dirección sigue pudiendo pasar a otro.
 */
export const SIMULAN_EQUIPO = ['director_comercial', 'admin', 'operator'];

// Se simula con el rol de la lista, no con el principal de la persona: alguien que es closer o
// setter además de otra cosa entra como eso.
const ROL_DE_LISTA = { closers: 'closer', setters: 'setter' };

export const cargarParaSimular = (clave) => async () => {
    const res = await api.get(`/auth/impersonate/${clave}`);
    return (res.data?.[clave] || []).map(c => ({
        id: c.id,
        label: c.username,
        onClick: async () => {
            const aviso = toast.loading(`Entrando como ${c.username}…`);
            try {
                await simularA(c.id, null, ROL_DE_LISTA[clave]);
            } catch (error) {
                toast.error(error?.response?.status === 403
                    ? `No podés simular a ${c.username}`
                    : `No se pudo simular a ${c.username}`, { id: aviso });
            }
        },
    }));
};

export const volverAMiSesion = async () => {
    try {
        await revertImpersonation();
    } catch (error) {
        toast.error(error?.response?.data?.message || 'No se pudo volver a tu sesión');
    }
};

/** "Closer", "Dirección comercial · simulación"... El rótulo bajo el nombre en el menú. */
export const rotuloDeSesion = (user, rotulo = null) =>
    [rotulo || rotuloDeRol(user?.role), user?.is_impersonating && 'simulación'].filter(Boolean).join(' · ');

/**
 * Los grupos del menú de sesión.
 * - acciones: las de trabajo de esta pantalla (opcional).
 * - configuracion: { onClick, avisos? } — "Configuración" está siempre; `avisos` (textos) le pone
 *   un "!" con el detalle (p. ej. "Google Calendar sin conectar").
 * - playbook: { onClick, pendientes? } (opcional).
 * - irAntes / irDespues: opciones de navegación propias (p. ej. Finances), antes o después de las de
 *   rol («Cambiar de área» va siempre primero).
 * - equipo: opciones de equipo propias además de simular (p. ej. "Simular a otra persona" del admin).
 */
export function armarMenuSesion({
    user, navigate, logout,
    acciones = [], configuracion, playbook = null,
    irAntes = [], irDespues = [], equipo = [],
}) {
    const rolReal = user?.is_impersonating ? user?.original_user_role : user?.role;
    const avisos = configuracion?.avisos?.filter(Boolean) || [];
    return [
        acciones,
        [
            { id: 'configuracion', label: 'Configuración', Icono: Settings, onClick: configuracion?.onClick,
                cuenta: avisos.length ? '!' : null, titulo: avisos.length ? avisos.join(' · ') : null },
            ...(playbook ? [{ id: 'playbook', label: 'Playbook', Icono: Compass, onClick: playbook.onClick,
                cuenta: playbook.pendientes > 0 ? playbook.pendientes : null,
                titulo: playbook.pendientes > 0 ? `${playbook.pendientes} pendientes` : null }] : []),
        ],
        [
            ...opcionCambiarDeArea(user, null, navigate),
            ...irAntes,
            ...opcionesDeRol(user, (m) => toast.error(m), navigate),
            ...irDespues,
        ],
        [
            ...(SIMULAN_EQUIPO.includes(rolReal) ? [
                { id: 'simular', label: 'Simular a un closer', Icono: VenetianMask,
                    panel: { titulo: 'Simular a un closer', vacio: 'No hay closers activos.', cargar: cargarParaSimular('closers') } },
                { id: 'simular-setter', label: 'Simular a un setter', Icono: VenetianMask,
                    panel: { titulo: 'Simular a un setter', vacio: 'No hay setters activos.', cargar: cargarParaSimular('setters') } },
            ] : []),
            ...equipo,
        ],
        [
            ...(user?.is_impersonating ? [{ id: 'volver', label: 'Volver a mi sesión', Icono: Ghost, onClick: volverAMiSesion }] : []),
            { id: 'salir', label: 'Cerrar sesión', Icono: LogOut, peligro: true,
                onClick: () => { if (window.confirm('¿Cerrar sesión?')) logout(); } },
        ],
    ];
}
