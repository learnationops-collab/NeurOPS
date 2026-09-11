import api from '../services/api';
import { saveSession } from './sessionStore';
import { roleLandingPath } from './roleLanding';

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
    window.location.href = roleLandingPath(originalUser.role);
};
