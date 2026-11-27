import axios from "axios";
import { triggerBugReport } from "../utils/bugReportBus";
import { limpiarCache } from "./cacheDeVistas";

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
        // 1. Inyectar token JWT si existe. sessionStorage tiene prioridad: es donde vive el
        // token de una pestaña de simulación aislada (clic derecho -> "Simular en pestaña
        // nueva"), y no está compartido con las demás pestañas como sí lo está localStorage.
        const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
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

// Work tiene un volumen en Railway: en cada deploy el servidor se apaga ~1 minuto y el proxy contesta
// 502/503 («Application failed to respond»). Los pedidos que se pueden repetir sin efecto doble (GET,
// PUT, DELETE; un POST solo con `reintentable: true`) se reintentan solos hasta ~90 s, con un aviso.
const CAIDO = new Set([502, 503, 504]);
const ESPERAS = [2000, 3000, 5000, 8000, 10000, 12000, 15000, 15000, 20000];
const REPETIBLES = new Set(['get', 'head', 'options', 'put', 'delete']);
const MSJ_ACTUALIZANDO = 'Work se está actualizando. Probá de nuevo en un minuto.';
let avisado = 0;
const avisar = (texto, tone) => import('../components/standard').then(m => m.toast(texto, tone)).catch(() => {});
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

api.interceptors.response.use(
    (response) => {
        // Lo recordado por las vistas (cacheDeVistas) deja de ser verdad apenas algo se guarda: la
        // próxima vez que se mire, se vuelve a pedir.
        const metodo = (response.config?.method || 'get').toLowerCase();
        // `conservarCache`: avisos sin efecto en lo que se muestra (ej. marcar un chat como leído).
        if (metodo !== 'get' && metodo !== 'head' && metodo !== 'options' && !response.config?.conservarCache) limpiarCache();
        return response;
    },
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

        const metodo = (error.config?.method || 'get').toLowerCase();
        if (error.config && CAIDO.has(error.response?.status) && (REPETIBLES.has(metodo) || error.config.reintentable)) {
            const intento = error.config._reintento || 0;
            if (intento < ESPERAS.length) {
                if (intento === 0 && Date.now() - avisado > 30000) { avisado = Date.now(); avisar('Work se está actualizando… reintentando solo.'); }
                error.config._reintento = intento + 1;
                await esperar(ESPERAS[intento]);
                return api.request(error.config);
            }
        }
        if (CAIDO.has(error.response?.status) && error.response.data && typeof error.response.data === 'object'
            && /failed to respond|bad gateway|unavailable/i.test(String(error.response.data.message || ''))) {
            error.response.data = { ...error.response.data, message: MSJ_ACTUALIZANDO };
        }

        // Fallo de servidor o de red en una petición que modifica estado: ofrece el
        // botón "Reportar error" reactivo (widget de feedback) con el contexto técnico
        // ya armado, sin tocar los cientos de toast.error(...) existentes por página.
        // Una petición CANCELADA no es un fallo: la cancela a propósito quien la hizo (la ficha
        // del lead aborta su carga al cerrarse o al cambiar de lead, y en desarrollo el doble
        // montaje de StrictMode lo hace en cada apertura). Sin respuesta, caía como "error de
        // red" y el widget ofrecía reportar "Algo falló en la última acción" sin que nada fallara.
        const isCanceled = error.code === 'ERR_CANCELED' || axios.isCancel(error);
        const isServerOrNetworkError = !isCanceled && (!error.response || error.response.status >= 500);
        if (isServerOrNetworkError && !error.config?.skipBugReport) {
            triggerBugReport({
                message: error.response?.data?.message || error.message,
                status: error.response?.status || null,
                url: error.config?.url,
                method: error.config?.method,
            });
        }

        return Promise.reject(error);
    }
);

export default api;
