import { LayoutGrid, User, Users } from 'lucide-react';
import api from '../services/api';
import { saveSession, isIsolatedTab } from './sessionStore';
import { AREAS, areasDe } from './areas';
import { ICONO_DE_ROL, otrasCuentas, rolDeFinanzas, rolesDeLaCuenta, rotuloDeRol } from './cuentasVinculadas';
import { roleLandingPath } from './roleLanding';
import { abrirPortal } from '../sesion/portalBus';

// El Portal (10/10/2026): una pantalla que se abre ENCIMA de lo que se está viendo (no es una ruta; ver
// sesion/PortalContext.jsx), al iniciar sesión si hay más de un área y desde «Portal» del menú de sesión.
// Separa ROLES de ÁREAS (utils/areas.js): primero los roles de la cuenta y de sus cuentas vinculadas (y
// Simular a alguien, para quien puede); al elegir uno, sus áreas y Cortex, que es común a todos los roles.
// Finances es un área del rol con el que se entra a ella.
// «Entrar directo la próxima vez» guarda el área elegida (por cuenta, en este navegador) y la próxima
// entrada va directo ahí.

export const CORTEX = AREAS.cortex;

const tarjeta = (rol, area, cuenta = null) => ({
    clave: `${cuenta ? `cuenta-${cuenta}` : rol}:${area.id}`, titulo: area.label, Icono: area.Icono, rol, ruta: area.ruta,
    ...(cuenta ? { cuenta } : {}),
});
// Un rol sin áreas conocidas entra a su pantalla de siempre.
const areasDelRol = (rol) => {
    const areas = areasDe(rol);
    return areas.length ? areas : [{ id: 'inicio', label: rotuloDeRol(rol), ruta: roleLandingPath(rol), Icono: ICONO_DE_ROL[rol] || User }];
};

/**
 * Los grupos del Portal: [{ clave, titulo, detalle?, Icono, tarjetas: [{ clave, titulo, Icono, rol, ruta, cuenta? }] }].
 * Un grupo por rol de la cuenta (simulando, solo el simulado) y uno por cuenta vinculada.
 */
export function gruposDelPortal(user) {
    if (!user) return [];
    const roles = user.is_impersonating ? [user.role] : rolesDeLaCuenta(user);
    const rolFinanzas = rolDeFinanzas(roles, user.can_view_finance);
    const propios = roles.map((rol) => ({
        clave: rol, titulo: rotuloDeRol(rol), Icono: ICONO_DE_ROL[rol] || User,
        tarjetas: [...areasDelRol(rol), ...(rol === rolFinanzas ? [AREAS.finanzas] : [])].map((a) => tarjeta(rol, a)),
    }));
    const vinculadas = otrasCuentas(user).map((c) => ({
        clave: `cuenta-${c.id}`, titulo: rotuloDeRol(c.role), detalle: `Cuenta vinculada · ${c.username}`, Icono: ICONO_DE_ROL[c.role] || Users,
        tarjetas: areasDelRol(c.role).map((a) => tarjeta(c.role, a, c.id)),
    }));
    return [...propios, ...vinculadas];
}

/** Las áreas de trabajo del Portal, todas juntas (sin Cortex ni Simular). Vacío simulando. */
export const tarjetasDelPortal = (user) => (
    !user || user.is_impersonating ? [] : gruposDelPortal(user).flatMap((g) => g.tarjetas)
);

/** True si tiene más de un área de trabajo: al entrar elige en el Portal (si no, va directo a la suya). */
export const hayPortal = (user) => tarjetasDelPortal(user).length > 1;

// La tarjeta por defecto es de cada cuenta, en este navegador (como el tema). La de antes era el área
// por rol (`area_por_defecto_<id>_<rol>`): se sigue leyendo hasta que se elija de nuevo.
const claveDefecto = (user) => `portal_por_defecto_v2_${user.id}`;
function guardada(user) {
    try {
        const nueva = localStorage.getItem(claveDefecto(user));
        if (nueva) return nueva;
        const area = localStorage.getItem(`area_por_defecto_${user.id}_${user.role}`);
        return area ? `${user.role}:${area === 'direccion' ? 'ventas' : area}` : null;
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
 * A dónde va al entrar con ese rol: su área por defecto si es de ese mismo rol, y si no, la pantalla de su
 * rol. Simulando, siempre la del rol simulado.
 */
export function destinoDeEntrada(user) {
    if (!user) return '/login';
    if (user.is_impersonating) return roleLandingPath(user.role);
    const def = tarjetaPorDefecto(user);
    return def && !def.cuenta && def.rol === user.role ? def.ruta : roleLandingPath(user.role);
}

/**
 * Al iniciar sesión: con un área por defecto, entra a esa (cambiando de rol o de cuenta si hace falta);
 * si no, a la pantalla de su rol y, si tiene más de un área, con el Portal abierto encima.
 */
export function entrarAlIniciar(user, navegar) {
    const def = tarjetaPorDefecto(user);
    if (def) return entrarPorTarjeta(user, def, navegar);
    navegar(roleLandingPath(user.role));
    if (hayPortal(user)) abrirPortal();
    return undefined;
}

/** Las áreas de un rol en el Portal: las suyas y Cortex, que es común a todos los roles. */
export const areasDelGrupo = (grupo) => [
    ...grupo.tarjetas,
    { clave: `${grupo.clave}:cortex`, titulo: CORTEX.label, Icono: CORTEX.Icono, ruta: CORTEX.ruta, comun: true },
];

/**
 * Pasa a otra cuenta de la persona en ESTA pestaña (en una aislada no toca la cookie) y entra a `destino`
 * o a donde entra esa cuenta.
 */
export const cambiarDeCuenta = async (userId, destino = null) => {
    const res = await api.post('/auth/switch-role', { user_id: userId, isolated: isIsolatedTab() });
    const { user, token } = res.data;
    saveSession(user, token);
    window.location.href = destino || destinoDeEntrada(user);
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
    if (tarjeta.comun) return navegar(tarjeta.ruta);
    if (tarjeta.cuenta) return cambiarDeCuenta(tarjeta.cuenta, tarjeta.ruta);
    if (tarjeta.rol === user.role) return navegar(tarjeta.ruta);
    return cambiarDeRolEnLaCuenta(tarjeta.rol, tarjeta.ruta);
}

/**
 * «Portal» para el menú de sesión: está siempre (ahí están Cortex y Simular) y abre el Portal encima de la
 * pantalla. `pendientes`: los videos pendientes del Playbook, que vive en Cortex, con la cuenta en la opción.
 */
export const opcionPortal = (user, pendientes = 0) => (user ? [{
    id: 'portal', label: 'Portal', Icono: LayoutGrid, onClick: () => abrirPortal(),
    cuenta: pendientes > 0 ? pendientes : null,
    titulo: pendientes > 0 ? `${pendientes} ${pendientes === 1 ? 'video pendiente' : 'videos pendientes'} del Playbook, en Cortex` : null,
}] : []);
