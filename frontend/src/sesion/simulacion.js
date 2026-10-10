// Quién puede simular y cómo abrir «Simular a alguien» desde cualquier lado. La hoja vive en
// SimulacionContext.jsx, que registra acá cómo abrirla; así el menú de sesión y las teclas no dependen
// del componente.
import { rolesDeLaCuenta } from '../utils/cuentasVinculadas';

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

let abrir = () => {};
export const registrarSimulacion = (fn) => { abrir = fn; return () => { if (abrir === fn) abrir = () => {}; }; };
export const abrirSimulacion = () => abrir();
