import { LayoutGrid, User, Users } from 'lucide-react';
import api from '../services/api';
import { saveSession, isIsolatedTab } from './sessionStore';
import { AREAS, areasDe } from './areas';
import { ICONO_DE_ROL, otrasCuentas, rolDeFinanzas, rolesDeLaCuenta, rotuloDeRol } from './cuentasVinculadas';
import { roleLandingPath } from './roleLanding';

// El Portal (/portal, 10/10/2026): la pantalla de entrada y de «Portal» en el menú de sesión. Muestra lo
// que la persona puede hacer, separando ROLES de ÁREAS (utils/areas.js): un grupo por cada rol de la
// cuenta y por cada cuenta vinculada, con sus áreas como tarjetas (Finances va en el rol con el que se
// entra a ella). Aparte, para todos, Cortex (Learnito y el Playbook) y, para quien puede, Simular a
// alguien del equipo.
// «Entrar directo la próxima vez» guarda el área elegida (por cuenta, en este navegador) y la próxima
// entrada la saltea. Desde el menú (?elegir=1) se muestra aunque haya una por defecto.

export const RUTA_PORTAL = '/portal';
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
    if (tarjeta.cuenta) return cambiarDeCuenta(tarjeta.cuenta, tarjeta.ruta);
    if (tarjeta.rol === user.role) return navegar(tarjeta.ruta);
    return cambiarDeRolEnLaCuenta(tarjeta.rol, tarjeta.ruta);
}

/**
 * «Portal» para el menú de sesión: está siempre (ahí están Cortex y Simular). `pendientes`: los videos
 * pendientes del Playbook, que ahora vive en Cortex, con la cuenta en la opción.
 */
export const opcionPortal = (user, navegar, pendientes = 0) => (user ? [{
    id: 'portal', label: 'Portal', Icono: LayoutGrid, onClick: () => navegar(`${RUTA_PORTAL}?elegir=1`),
    cuenta: pendientes > 0 ? pendientes : null,
    titulo: pendientes > 0 ? `${pendientes} ${pendientes === 1 ? 'video pendiente' : 'videos pendientes'} del Playbook, en Cortex` : null,
}] : []);
