import {
    ArrowLeftRight, BarChart3, Briefcase, Filter, Megaphone, MessageCircle, PhoneCall, Settings2, UserPlus, Wallet,
} from 'lucide-react';
import api from '../services/api';
import { saveSession, isIsolatedTab } from './sessionStore';
import { roleLandingPath } from './roleLanding';

// Una persona con varios roles tiene una cuenta por rol, enlazadas en el backend (`persona_id`).
// El usuario guardado en la sesión trae `cuentas_vinculadas`: las cuentas de la persona, con la
// actual marcada `activa`. Pasar a otra NO es una simulación: no hay «Volver a mi sesión» y se
// puede ir y volver cuando se quiera.

const ROTULO_DE_ROL = {
    admin: 'Administrador',
    operator: 'Operador',
    setter: 'Setter',
    triage: 'Triage',
    closer: 'Closer',
    director_comercial: 'Dirección comercial',
    director_marketing: 'Dirección de marketing',
    hiring: 'Hiring',
};

export const rotuloDeRol = (rol) => ROTULO_DE_ROL[rol] || rol;

// El ícono de cada rol en las pantallas donde se elige uno (el login y la simulación).
export const ICONO_DE_ROL = {
    admin: Settings2, director_comercial: BarChart3, director_marketing: Megaphone, closer: PhoneCall,
    setter: MessageCircle, operator: Briefcase, triage: Filter, hiring: UserPlus,
};

/**
 * La tarjeta «Finances» de las pantallas donde se elige un rol (el login y la simulación, desde el
 * 08/10/2026; se lee «Learnation Finances»): Finanzas y Payroll en su propia vista, /finanzas, aparte
 * del dashboard de la dirección comercial. No es un rol: entra con el que las habilita —admin o
 * dirección comercial, y además «ver finanzas», como `puede_ver_finanzas` en
 * app/api/public/finance.py—. `rolDeFinanzas` es null si no tiene ninguno de los dos o le falta el
 * permiso.
 */
export const TITULO_FINANZAS = 'Finances';
export const RUTA_FINANZAS = '/finanzas';
export const ICONO_FINANZAS = Wallet;
const ROLES_FINANZAS = ['admin', 'director_comercial'];
export const rolDeFinanzas = (roles, puedeVerFinanzas) => (
    puedeVerFinanzas ? ROLES_FINANZAS.find((r) => (roles || []).includes(r)) || null : null
);

/** Los OTROS roles de la misma cuenta (vacío si tiene uno solo o está simulando a alguien). */
export const otrosRoles = (user) => {
    if (!user || user.is_impersonating) return [];
    return (user.roles || []).filter((r) => r !== user.role);
};

/** Las OTRAS cuentas de la persona (vacío si no tiene vínculos o está simulando a alguien). */
export const otrasCuentas = (user) => {
    if (!user || user.is_impersonating) return [];
    return (user.cuentas_vinculadas || []).filter((c) => !c.activa && c.id !== user.id);
};

/**
 * Pasa a otra cuenta de la misma persona en ESTA pestaña y entra a la pantalla de su rol. En una
 * pestaña aislada (JWT en sessionStorage) no se toca la cookie compartida del navegador.
 */
export const cambiarDeRol = async (userId) => {
    const res = await api.post('/auth/switch-role', { user_id: userId, isolated: isIsolatedTab() });
    const { user, token } = res.data;
    saveSession(user, token);
    window.location.href = roleLandingPath(user.role);
};

/**
 * Pasa a otro rol de la MISMA cuenta (no es una simulación) y entra a la pantalla de ese rol, o a
 * `destino` si se pasa (la tarjeta «Finances» entra con admin y va a /finanzas).
 */
export const cambiarDeRolEnLaCuenta = async (rol, destino = null) => {
    const res = await api.post('/auth/switch-role', { role: rol, isolated: isIsolatedTab() });
    const { user, token } = res.data;
    saveSession(user, token);
    window.location.href = destino || roleLandingPath(user.role);
};

/**
 * Las opciones del menú de sesión para cambiar de rol: «Pasar a Closer», una por cuenta. Es una
 * lista vacía si la persona tiene una sola cuenta, así que se puede poner siempre en `grupos`.
 */
export const opcionesDeRol = (user, onError = () => {}) => {
    const intentar = (accion) => async () => {
        try {
            await accion();
        } catch (e) {
            onError(e?.response?.data?.message || 'No se pudo cambiar de rol');
        }
    };
    return [
        ...otrosRoles(user).map((rol) => ({
            id: `rol-${rol}`,
            label: `Pasar a ${rotuloDeRol(rol)}`,
            Icono: ArrowLeftRight,
            onClick: intentar(() => cambiarDeRolEnLaCuenta(rol)),
        })),
        ...otrasCuentas(user).map((c) => ({
            id: `rol-${c.id}`,
            label: `Pasar a ${rotuloDeRol(c.role)}`,
            Icono: ArrowLeftRight,
            titulo: c.username,
            onClick: intentar(() => cambiarDeRol(c.id)),
        })),
    ];
};

/**
 * Ir y volver entre Finances y la pantalla del rol desde el menú de sesión (08/10/2026): son dos vistas
 * separadas y ninguna puede quedar sin salida a la otra. No cambia de rol, solo navega (`navegar`).
 *   - Fuera de /finanzas: «Pasar a Finances», si la ve con el rol con el que está (`puede`: por
 *     defecto, lo que dice la sesión; el dashboard comercial pasa lo que le dijo el backend).
 *   - En /finanzas (`enFinanzas`): «Pasar a <rol>», la vuelta a la pantalla de su rol (el dashboard
 *     comercial para la dirección, Ventas para el admin), como las tarjetas de la elección.
 * Es una lista vacía si no corresponde, así que se puede poner siempre en `grupos`.
 */
export const opcionesDeFinanzas = (user, navegar, { enFinanzas = false, puede } = {}) => {
    if (!user) return [];
    if (enFinanzas) {
        return [{
            id: 'rol-actual', label: `Pasar a ${rotuloDeRol(user.role)}`, Icono: ICONO_DE_ROL[user.role] || ArrowLeftRight,
            onClick: () => navegar(roleLandingPath(user.role)),
        }];
    }
    const ve = puede ?? !!rolDeFinanzas([user.role], user.can_view_finance);
    return ve ? [{
        id: 'finanzas', label: `Pasar a ${TITULO_FINANZAS}`, Icono: ICONO_FINANZAS,
        onClick: () => navegar(RUTA_FINANZAS),
    }] : [];
};
