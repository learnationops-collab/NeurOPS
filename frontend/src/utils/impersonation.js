import api from '../services/api';
import { saveSession } from './sessionStore';
import { roleLandingPath } from './roleLanding';
import { destinoDeEntrada } from './areas';

// "Volver a mi sesión" tras una simulación: pide al backend la identidad original,
// la guarda en el store que esté usando ESTA pestaña (localStorage o, si es una
// pestaña aislada, sessionStorage — ver sessionStore.js) y recarga en la pantalla
// de aterrizaje del rol original. Vive acá y no dentro de OperatorControls porque
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
