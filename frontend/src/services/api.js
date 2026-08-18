import axios from "axios";

// Sin timeout, una petición colgada (proxy, servidor saturado, red) dejaba cualquier acción del
// mazo (ej. "Pagó" → registrar cobro) con el spinner girando para siempre, sin error ni forma de
// reintentar salvo recargar la página. 45s da margen de sobra a la petición más lenta del sistema
// (sync con Google Sheets, que el backend ya cota en 30s) y aun así garantiza que todo lo demás
// falle de forma visible en vez de quedar colgado.
const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
    timeout: 45000,
});

let csrfToken = null;
let csrfTokenPromise = null;

// Obtiene o solicita el token CSRF una sola vez de forma compartida.
// forceRefresh descarta el token cacheado (usado cuando el backend lo rechaza por vencido).
const fetchCsrfToken = (forceRefresh = false) => {
    if (forceRefresh) {
        csrfToken = null;
        csrfTokenPromise = null;
    }
    if (csrfToken) return Promise.resolve(csrfToken);
    if (csrfTokenPromise) return csrfTokenPromise;

    // Timeout corto a propósito: esta llamada bloquea TODA petición que modifica estado (se espera
    // antes de cada POST/PUT/PATCH/DELETE), así que si se cuelga no puede arrastrar consigo los 45s
    // completos del timeout general — mejor fallar rápido y dejar seguir la petición sin token (el
    // backend la rechazará con 400/403, visible, en vez de sumar su propia espera a la de encima).
    csrfTokenPromise = axios.get("/api/auth/csrf-token", { withCredentials: true, timeout: 10000 })
        .then(res => {
            csrfToken = res.data.csrf_token;
            csrfTokenPromise = null;
            return csrfToken;
        })
        .catch(err => {
            console.error("Error fetching CSRF token:", err);
            csrfTokenPromise = null; // Permitir reintento en caso de error
            return null;
        });

    return csrfTokenPromise;
};

// Request interceptor to add JWT and CSRF tokens
api.interceptors.request.use(
    async (config) => {
        // 1. Inyectar token JWT si existe
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // 2. Inyectar token CSRF para peticiones que modifican estado (POST, PUT, DELETE, PATCH)
        const method = config.method ? config.method.toLowerCase() : 'get';
        if (method !== 'get' && method !== 'head' && method !== 'options') {
            const csrf = await fetchCsrfToken();
            if (csrf) {
                config.headers['X-CSRFToken'] = csrf;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            // Allow requests to skip global auth error handling (e.g. background fetches)
            if (!error.config?.skipAuthError) {
                window.dispatchEvent(new Event("auth-unauthorized"));
            }
        }

        // Token CSRF vencido (sesiones/formularios largos, ej. el modal de seguimiento con el
        // paso de referidos): en vez de fallar y obligar a recargar la página, se refresca el
        // token y se reintenta la petición original una sola vez.
        const isCsrfExpired = error.response
            && error.response.status === 400
            && typeof error.response.data === 'string'
            && error.response.data.includes('CSRF');
        if (isCsrfExpired && error.config && !error.config._csrfRetried) {
            error.config._csrfRetried = true;
            const freshToken = await fetchCsrfToken(true);
            if (freshToken) {
                error.config.headers['X-CSRFToken'] = freshToken;
                return api.request(error.config);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
