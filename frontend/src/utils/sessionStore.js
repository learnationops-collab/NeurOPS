// La sesión de una pestaña vive en sessionStorage cuando esa pestaña se abrió de forma
// aislada (clic derecho -> "Simular en pestaña nueva": ver TeamManagementPage.jsx /
// OperatorControls.jsx), o en localStorage para el flujo normal (login real, o "Simular"
// con clic izquierdo de toda la vida, compartido entre pestañas como siempre funcionó).
//
// sessionStorage NO se comparte entre pestañas del mismo navegador (a diferencia de
// localStorage y de la cookie de sesión del backend), así que es lo que permite que cada
// pestaña sostenga una identidad simulada distinta en paralelo. El backend complementa esto
// dándole prioridad al Authorization Bearer sobre la cookie compartida cuando ambos llegan
// en el mismo request (ver TokenPriorityLoginManager en app/__init__.py).
const activeStore = () => (sessionStorage.getItem('auth_token') ? sessionStorage : localStorage);

export const loadSession = () => {
    const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
};

export const saveSession = (user, token) => {
    const store = activeStore();
    store.setItem('user', JSON.stringify(user));
    if (token) store.setItem('auth_token', token);
};

export const clearSession = () => {
    const store = activeStore();
    store.removeItem('user');
    store.removeItem('auth_token');
};

export const isIsolatedTab = () => !!sessionStorage.getItem('auth_token');
