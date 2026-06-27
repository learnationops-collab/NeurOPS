import axios from "axios";

const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
});

let csrfToken = null;
let csrfTokenPromise = null;

// Obtiene o solicita el token CSRF una sola vez de forma compartida
const fetchCsrfToken = () => {
    if (csrfToken) return Promise.resolve(csrfToken);
    if (csrfTokenPromise) return csrfTokenPromise;

    csrfTokenPromise = axios.get("/api/auth/csrf-token", { withCredentials: true })
        .then(res => {
            csrfToken = res.data.csrf_token;
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
    (error) => {
        if (error.response && error.response.status === 401) {
            // Allow requests to skip global auth error handling (e.g. background fetches)
            if (!error.config?.skipAuthError) {
                window.dispatchEvent(new Event("auth-unauthorized"));
            }
        }
        return Promise.reject(error);
    }
);

export default api;
