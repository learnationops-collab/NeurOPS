import { LayoutGrid, User, Users } from 'lucide-react';
import api from '../services/api';
import { saveSession, isIsolatedTab } from './sessionStore';
import { areasDe } from './areas';
import {
    ICONO_DE_ROL, ICONO_FINANZAS, RUTA_FINANZAS, TITULO_FINANZAS, otrasCuentas, rolDeFinanzas, rolesDeLaCuenta, rotuloDeRol,
} from './cuentasVinculadas';
import { roleLandingPath } from './roleLanding';

// El Portal (/portal, 10/10/2026): la pantalla de entrada para quien tiene más de un lugar adonde ir.
// Junta lo que antes eran tres elecciones (el rol en el login, el área en /inicio y el hub de vistas en
// /vistas) en una sola, con una tarjeta por destino:
//   - cada rol de la cuenta: su pantalla, o una tarjeta por área si tiene varias (Dirección, Agendamiento…);
//   - cada cuenta vinculada de la persona;
//   - Finances, si la ve.
// «Entrar directo la próxima vez» guarda la tarjeta elegida (por cuenta, en este navegador) y la próxima
// entrada la saltea. Desde el menú de sesión, «Cambiar de vista» vuelve al Portal (?elegir=1 lo muestra
// aunque haya una por defecto).

export const RUTA_PORTAL = '/portal';

/**
 * Las tarjetas del Portal: [{ clave, titulo, sobre?, detalle?, Icono, rol?, ruta?, cuenta? }].
 * `rol` + `ruta`: entra con ese rol de la cuenta a esa ruta. `cuenta`: pasa a esa cuenta vinculada.
 * Vacío simulando a otro (se simula con un rol y no se cambia).
 */
export function tarjetasDelPortal(user) {
    if (!user || user.is_impersonating) return [];
    const roles = rolesDeLaCuenta(user);
    const varios = roles.length > 1;
    const deRoles = roles.flatMap((rol) => {
        const areas = areasDe(rol);
        if (areas.length < 2) {
            return [{ clave: rol, titulo: rotuloDeRol(rol), Icono: ICONO_DE_ROL[rol] || User, rol, ruta: roleLandingPath(rol) }];
        }
        return areas.map((a) => ({
            clave: `${rol}:${a.id}`, titulo: a.label, sobre: varios ? rotuloDeRol(rol) : null, Icono: a.Icono, rol, ruta: a.ruta,
        }));
    });
    const cuentas = otrasCuentas(user).map((c) => ({
        clave: `cuenta-${c.id}`, titulo: rotuloDeRol(c.role), sobre: 'Cuenta vinculada', detalle: c.username,
        Icono: ICONO_DE_ROL[c.role] || Users, cuenta: c.id,
    }));
    const rolFinanzas = rolDeFinanzas(roles, user.can_view_finance);
    const finanzas = rolFinanzas
        ? [{ clave: 'finanzas', titulo: TITULO_FINANZAS, Icono: ICONO_FINANZAS, rol: rolFinanzas, ruta: RUTA_FINANZAS }]
        : [];
    return [...deRoles, ...cuentas, ...finanzas];
}

/** True si tiene más de una tarjeta: hay Portal y «Cambiar de vista» en el menú. */
export const hayPortal = (user) => tarjetasDelPortal(user).length > 1;

// La tarjeta por defecto es de cada cuenta, en este navegador (como el tema). La de antes era el área
// por rol (`area_por_defecto_<id>_<rol>`): se sigue leyendo hasta que se elija de nuevo.
const claveDefecto = (user) => `portal_por_defecto_${user.id}`;
function guardada(user) {
    try {
        const nueva = localStorage.getItem(claveDefecto(user));
        if (nueva) return nueva;
        const area = localStorage.getItem(`area_por_defecto_${user.id}_${user.role}`);
        return area ? `${user.role}:${area}` : null;
    } catch {
        return null;
    }
}

/** La tarjeta con la que entra directo, si eligió una y todavía la tiene. */
export function tarjetaPorDefecto(user) {
    if (!user) return null;
    const clave = guardada(user);
    return (clave && tarjetasDelPortal(user).find((t) => t.clave === clave)) || null;
}

export function fijarTarjetaPorDefecto(user, clave) {
    try {
        if (clave) localStorage.setItem(claveDefecto(user), clave);
        else localStorage.removeItem(claveDefecto(user));
        localStorage.removeItem(`area_por_defecto_${user.id}_${user.role}`);
    } catch { /* sin storage: se elige cada vez */ }
}

/**
 * A dónde va al entrar: la pantalla de su rol si no hay nada que elegir (o está simulando), su tarjeta
 * por defecto si es del rol con el que ya está, y si no, el Portal (que entra solo a la por defecto si
 * hace falta cambiar de rol o de cuenta).
 */
export function destinoDeEntrada(user) {
    if (!user) return '/login';
    if (user.is_impersonating || !hayPortal(user)) return roleLandingPath(user.role);
    const def = tarjetaPorDefecto(user);
    return def && !def.cuenta && def.rol === user.role ? def.ruta : RUTA_PORTAL;
}

/** Pasa a otra cuenta de la persona en ESTA pestaña (en una aislada no toca la cookie) y entra. */
export const cambiarDeCuenta = async (userId) => {
    const res = await api.post('/auth/switch-role', { user_id: userId, isolated: isIsolatedTab() });
    const { user, token } = res.data;
    saveSession(user, token);
    window.location.href = destinoDeEntrada(user);
};

/** Pasa a otro rol de la MISMA cuenta (no es una simulación) y entra a `destino` o a donde entra ese rol. */
export const cambiarDeRolEnLaCuenta = async (rol, destino = null) => {
    const res = await api.post('/auth/switch-role', { role: rol, isolated: isIsolatedTab() });
    const { user, token } = res.data;
    saveSession(user, token);
    window.location.href = destino || destinoDeEntrada(user);
};

/** Entra por una tarjeta: con el rol que ya tiene solo navega; si no, cambia de rol o de cuenta. */
export function entrarPorTarjeta(user, tarjeta, navegar) {
    if (tarjeta.cuenta) return cambiarDeCuenta(tarjeta.cuenta);
    if (tarjeta.rol === user.role) return navegar(tarjeta.ruta);
    return cambiarDeRolEnLaCuenta(tarjeta.rol, tarjeta.ruta);
}

/**
 * «Cambiar de vista» para el menú de sesión: vuelve al Portal. Lista vacía si no hay nada que elegir o
 * está simulando, así que se puede poner siempre.
 */
export const opcionPortal = (user, navegar) => (hayPortal(user) ? [{
    id: 'portal', label: 'Cambiar de vista', Icono: LayoutGrid, onClick: () => navegar(`${RUTA_PORTAL}?elegir=1`),
}] : []);
