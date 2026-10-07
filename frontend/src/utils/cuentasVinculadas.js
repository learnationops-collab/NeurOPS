import { ArrowLeftRight } from 'lucide-react';
import api from '../services/api';
import { saveSession, isIsolatedTab } from './sessionStore';
import { destinoDeEntrada } from './areas';

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
    window.location.href = destinoDeEntrada(user);
};

/** Pasa a otro rol de la MISMA cuenta (no es una simulación) y entra a la pantalla de ese rol. */
export const cambiarDeRolEnLaCuenta = async (rol) => {
    const res = await api.post('/auth/switch-role', { role: rol, isolated: isIsolatedTab() });
    const { user, token } = res.data;
    saveSession(user, token);
    window.location.href = destinoDeEntrada(user);
};

/**
 * La opción «Cambiar de rol» del menú de sesión: un panel con los otros roles y cuentas de la persona.
 * Es una lista vacía si tiene uno solo, así que se puede poner siempre en `grupos`.
 */
export const opcionesDeRol = (user, onError = () => {}) => {
    const intentar = (accion) => async () => {
        try {
            await accion();
        } catch (e) {
            onError(e?.response?.data?.message || 'No se pudo cambiar de rol');
        }
    };
    const otros = [
        ...otrosRoles(user).map((rol) => ({
            id: `rol-${rol}`,
            label: rotuloDeRol(rol),
            onClick: intentar(() => cambiarDeRolEnLaCuenta(rol)),
        })),
        ...otrasCuentas(user).map((c) => ({
            id: `rol-${c.id}`,
            label: `${rotuloDeRol(c.role)} · ${c.username}`,
            onClick: intentar(() => cambiarDeRol(c.id)),
        })),
    ];
    if (!otros.length) return [];
    return [{
        id: 'rol', label: 'Cambiar de rol', Icono: ArrowLeftRight,
        panel: { titulo: 'Cambiar de rol', vacio: 'No tenés otros roles.', cargar: () => otros },
    }];
};
