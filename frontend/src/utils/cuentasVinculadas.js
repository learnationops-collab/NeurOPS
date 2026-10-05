import { ArrowLeftRight } from 'lucide-react';
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
 * Las opciones del menú de sesión para cambiar de rol: «Pasar a Closer», una por cuenta. Es una
 * lista vacía si la persona tiene una sola cuenta, así que se puede poner siempre en `grupos`.
 */
export const opcionesDeRol = (user, onError = () => {}) => otrasCuentas(user).map((c) => ({
    id: `rol-${c.id}`,
    label: `Pasar a ${rotuloDeRol(c.role)}`,
    Icono: ArrowLeftRight,
    titulo: c.username,
    onClick: async () => {
        try {
            await cambiarDeRol(c.id);
        } catch (e) {
            onError(e?.response?.data?.message || 'No se pudo cambiar de rol');
        }
    },
}));
