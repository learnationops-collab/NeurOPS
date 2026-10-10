import api from '../services/api';
import { saveSession } from './sessionStore';
import { roleLandingPath } from './roleLanding';
import { destinoDeEntrada } from './portal';

// "Volver a mi sesión" tras una simulación: pide al backend la identidad original,
// la guarda en el store que esté usando ESTA pestaña (localStorage o, si es una
// pestaña aislada, sessionStorage — ver sessionStore.js) y recarga en la pantalla
// de aterrizaje del rol original. Vive acá y no dentro de la hoja de simulación porque
// las sub-apps sin MainLayout (Hiring) necesitan ofrecer la misma salida con un
// botón propio, sin duplicar el flujo.
export const revertImpersonation = async () => {
    const res = await api.post('/auth/revert');
    const { user: originalUser, token } = res.data;
    saveSession(originalUser, token);
    window.location.href = destinoDeEntrada(originalUser);
};

// Empezar a simular a alguien en ESTA pestaña (el modo de siempre, con la cookie): guarda la
// sesión simulada y entra a la pantalla de su rol. La usa el menú de sesión del dock de la
// dirección comercial ("Simular a un closer"); el backend decide a quién se puede simular.
// destino: a dónde entra (por defecto, la pantalla de su rol; Agendamiento abre su Configuración).
// rol: con cuál de sus roles (una persona con varios se simula con uno a la vez); sin él, el principal.
export const simularA = async (userId, destino = null, rol = null) => {
    const res = await api.post('/auth/impersonate', { user_id: userId, ...(rol ? { role: rol } : {}) });
    const { user, token } = res.data;
    saveSession(user, token);
    window.location.href = destino || roleLandingPath(user.role);
};

/**
 * Simular en una pestaña NUEVA, aislada de esta y de cualquier otra simulación (para simular a varios a
 * la vez en el mismo navegador). Hay que llamarla directo desde el clic: la pestaña se abre antes de
 * esperar al backend porque los navegadores bloquean un window.open() que llega después de un await;
 * se navega cuando llega la respuesta. Si falla, cierra la pestaña y lanza el error.
 */
export const simularEnPestanaNueva = async (userId, destino = null, rol = null) => {
    const pestana = window.open('', '_blank');
    try {
        const res = await api.post('/auth/impersonate', { user_id: userId, isolated: true, ...(rol ? { role: rol } : {}) });
        const { user, token } = res.data;
        if (!pestana) throw new Error('El navegador bloqueó la pestaña nueva. Habilitá las ventanas emergentes para este sitio.');
        const params = new URLSearchParams({ token, u: JSON.stringify(user), next: destino || roleLandingPath(user.role) });
        pestana.location.href = `/session-entry?${params.toString()}`;
    } catch (err) {
        pestana?.close();
        throw err;
    }
};
