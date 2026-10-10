// El menú de sesión (el desplegable al lado del dock, pages/comercial/components/MenuSesion.jsx) con
// los mismos grupos, en el mismo orden y con los mismos nombres en todas las pantallas. Cada pantalla
// aporta solo lo suyo: sus acciones de trabajo y, si corresponde, a dónde más puede ir.
//
//   [Acciones de esta pantalla]  Nueva agenda, Referido, Mis links... (opcional)
//   [Mi cuenta]                  Configuración · Playbook
//   [Ir a]                       Cambiar de vista (el Portal: roles, áreas, cuentas y Finances)
//   [Equipo]                     Simular a alguien (quien puede)
//   [Ayuda]                      Reportar un problema · Mis reportes (lo agrega MenuSesion solo)
//   [Salida]                     Volver a mi sesión · Cerrar sesión
//
// Desde el 10/10/2026 «Cambiar de área», «Cambiar de vista» y «Cambiar de rol» son una sola opción (el
// Portal, utils/portal.js), y las simulaciones («a un closer», «a un setter», «Configurar a un closer»,
// «Simular a otra persona») son una sola hoja (sesion/Simular.jsx).
import toast from 'react-hot-toast';
import { Compass, Ghost, LogOut, Settings, VenetianMask } from 'lucide-react';
import { rotuloDeRol } from '../utils/cuentasVinculadas';
import { revertImpersonation } from '../utils/impersonation';
import { opcionPortal } from '../utils/portal';
import { abrirSimulacion, puedeSimular } from './simulacion';

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
 * - irAntes / irDespues: opciones de navegación propias, antes o después de «Cambiar de vista».
 */
export function armarMenuSesion({
    user, navigate, logout,
    acciones = [], configuracion, playbook = null,
    irAntes = [], irDespues = [],
}) {
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
        [...irAntes, ...opcionPortal(user, navigate), ...irDespues],
        puedeSimular(user) ? [{ id: 'simular', label: 'Simular a alguien', Icono: VenetianMask, onClick: abrirSimulacion }] : [],
        [
            ...(user?.is_impersonating ? [{ id: 'volver', label: 'Volver a mi sesión', Icono: Ghost, onClick: volverAMiSesion }] : []),
            { id: 'salir', label: 'Cerrar sesión', Icono: LogOut, peligro: true,
                onClick: () => { if (window.confirm('¿Cerrar sesión?')) logout(); } },
        ],
    ];
}
