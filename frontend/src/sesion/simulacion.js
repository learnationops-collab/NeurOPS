// Quién puede simular y cómo abrir «Simular a alguien» (un paso del Portal) desde cualquier lado, como la
// tecla «w» de cada pantalla.
import { rolesDeLaCuenta } from '../utils/cuentasVinculadas';
import { abrirPortal } from './portalBus';

/**
 * Lo decide el backend (`_roles_que_puede_simular` en app/api/auth.py); esto solo evita ofrecer la
 * opción a quien recibiría un 403. Cuenta cualquiera de los roles de la cuenta (no solo el activo) y,
 * simulando, el de quien está detrás: simulando a un closer, la dirección sigue pudiendo pasar a otro.
 */
const SIMULAN = ['admin', 'operator', 'director_comercial'];
export const puedeSimular = (user) => {
    if (!user) return false;
    const roles = user.is_impersonating ? [user.original_user_role] : rolesDeLaCuenta(user);
    return roles.some((r) => SIMULAN.includes(r));
};

/** Abre el Portal en Simular a alguien; si la persona no puede simular, no hace nada (PortalContext). */
export const abrirSimulacion = () => abrirPortal('simular');
