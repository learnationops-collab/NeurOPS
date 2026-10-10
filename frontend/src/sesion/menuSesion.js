// El menú de sesión (el desplegable al lado del dock, pages/comercial/components/MenuSesion.jsx) con
// los mismos grupos, en el mismo orden y con los mismos nombres en todas las pantallas. Cada pantalla
// aporta solo sus acciones de trabajo.
//
//   [Acciones de esta pantalla]  Nueva agenda, Referido, Mis links... (opcional)
//   [Mi cuenta]                  Configuración · Portal
//   [Ayuda]                      Mis reportes [+] (lo agrega MenuSesion solo; el «+» reporta uno nuevo)
//   [Salida]                     Volver a mi sesión · Cerrar sesión
//
// El Portal (utils/portal.js) junta lo que antes eran opciones sueltas: cambiar de rol, de área o de
// cuenta, Finances, Simular a alguien y Cortex (Learnito y el Playbook, 10/10/2026).
import toast from 'react-hot-toast';
import { Ghost, LogOut, Settings } from 'lucide-react';
import { rotuloDeRol } from '../utils/cuentasVinculadas';
import { revertImpersonation } from '../utils/impersonation';
import { opcionPortal } from '../utils/portal';

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
 * - playbook: { pendientes } (opcional): los videos pendientes, con la cuenta en «Portal» (el Playbook
 *   está en Cortex).
 * - ir: opciones de navegación propias, después de «Portal» (p. ej. «Volver al panel de admin»).
 */
export function armarMenuSesion({
    user, navigate, logout,
    acciones = [], configuracion, playbook = null, ir = [],
}) {
    const avisos = configuracion?.avisos?.filter(Boolean) || [];
    return [
        acciones,
        [
            { id: 'configuracion', label: 'Configuración', Icono: Settings, onClick: configuracion?.onClick,
                cuenta: avisos.length ? '!' : null, titulo: avisos.length ? avisos.join(' · ') : null },
            ...opcionPortal(user, navigate, playbook?.pendientes || 0),
            ...ir,
        ],
        [
            ...(user?.is_impersonating ? [{ id: 'volver', label: 'Volver a mi sesión', Icono: Ghost, onClick: volverAMiSesion }] : []),
            { id: 'salir', label: 'Cerrar sesión', Icono: LogOut, peligro: true,
                onClick: () => { if (window.confirm('¿Cerrar sesión?')) logout(); } },
        ],
    ];
}
