import axios from "axios";

const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
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

    csrfTokenPromise = axios.get("/api/auth/csrf-token", { withCredentials: true })
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
