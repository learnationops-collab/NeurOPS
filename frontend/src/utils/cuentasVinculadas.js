import {
    BarChart3, Briefcase, Filter, Megaphone, MessageCircle, PhoneCall, Settings2, UserPlus, Wallet,
} from 'lucide-react';

// Una persona con varios roles tiene una cuenta por rol, enlazadas en el backend (`persona_id`).
// El usuario guardado en la sesión trae `cuentas_vinculadas`: las cuentas de la persona, con la
// actual marcada `activa`. Pasar a otra NO es una simulación: no hay «Volver a mi sesión» y se
// puede ir y volver cuando se quiera, desde el Portal (utils/portal.js).

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

// El ícono de cada rol en las pantallas donde se elige uno (el Portal y la simulación).
export const ICONO_DE_ROL = {
    admin: Settings2, director_comercial: BarChart3, director_marketing: Megaphone, closer: PhoneCall,
    setter: MessageCircle, operator: Briefcase, triage: Filter, hiring: UserPlus,
};

/**
 * La tarjeta «Finances» de las pantallas donde se elige un rol (el Portal y la simulación, desde el
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

/** Los roles de la cuenta, con el principal primero (si no vienen, el activo). */
export const rolesDeLaCuenta = (user) => (user?.roles?.length ? user.roles : [user?.role]).filter(Boolean);

/** Las OTRAS cuentas de la persona (vacío si no tiene vínculos o está simulando a alguien). */
export const otrasCuentas = (user) => {
    if (!user || user.is_impersonating) return [];
    return (user.cuentas_vinculadas || []).filter((c) => !c.activa && c.id !== user.id);
};
