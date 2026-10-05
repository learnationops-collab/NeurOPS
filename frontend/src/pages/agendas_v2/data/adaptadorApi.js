// Adaptador de guardado contra el backend (/api/agendas-v2, docs/agendas_v2_api.md). Mismo contrato que
// adaptadorLocal.js. Usa la instancia `api` de la app, así que la sesión (JWT) y el token CSRF van solos.
//
// Detalles propios de la API:
//   - guardar() manda PATCH con los campos que cambiaron si el documento ya existe en el servidor;
//     si no (o si el servidor no lo encuentra), PUT con el documento entero.
//   - alCambiar() consulta /version cada 15 s con la pestaña visible (y al volver a ella). Las versiones
//     que devuelven nuestras propias escrituras cuentan como conocidas: guardar no provoca una recarga.
//   - Las reservas las crea solo la página pública (/api/agendas-v2/publico/reservas), no la gestión.

import api from '../../../services/api';
import { COLECCIONES } from '../core/normalizar';

const CADA = 15000;

// Error de axios → error con el código que entiende msgError() del almacén.
export function errorDeApi(e) {
    const st = e && e.response ? e.response.status : null;
    const datos = e && e.response && e.response.data && typeof e.response.data === 'object' ? e.response.data : {};
    const err = new Error(datos.message || datos.error || (e && e.message) || 'Falló el pedido');
    err.status = st;
    if (st === 403) err.code = 'invalid_argument';
    else if (st === 401) err.code = 'revoked';
    else if (!st) err.code = (e && (e.code === 'ERR_CANCELED' || e.name === 'CanceledError')) ? 'cancelado' : 'unavailable';
    else err.code = datos.code || 'error';
    return err;
}

const estado = (e) => (e && e.response ? e.response.status : null);

// El estado trae cada colección como lista de documentos con id (como adaptadorLocal); por las dudas
// también acepta un objeto {id: doc}.
function lista(x) {
    if (Array.isArray(x)) return x;
    if (x && typeof x === 'object') return Object.entries(x).map(([id, doc]) => ({ ...doc, id }));
    return [];
}

export function crearAdaptadorApi() {
    let version = null;      // última versión conocida (la de cargar o la de nuestras escrituras)
    let ajeno = false;       // una escritura nuestra saltó más de una versión: alguien más guardó en el medio
    let enVuelo = 0;         // escrituras nuestras sin respuesta todavía
    const enServidor = new Set();  // 'col/id' que el servidor ya tiene (para elegir PATCH o PUT)

    // Anota la versión que devolvió una escritura nuestra.
    function notar(v) {
        if (typeof v !== 'number') return;
        if (version != null && v > version + enVuelo) ajeno = true;
        if (version == null || v > version) version = v;
    }

    // Corre una escritura que sube la versión.
    async function escribir(fn) {
        enVuelo++;
        try {
            const r = await fn();
            notar(r && r.data ? r.data.version : undefined);
            return r ? r.data : null;
        } catch (e) {
            throw errorDeApi(e);
        } finally {
            enVuelo--;
        }
    }

    return {
        tipo: 'api',

        async cargar() {
            let data;
            try { ({ data } = await api.get('/agendas-v2/estado')); } catch (e) { throw errorDeApi(e); }
            data = data || {};
            const cols = {};
            enServidor.clear();
            COLECCIONES.forEach(c => {
                cols[c] = lista(data.cols && data.cols[c]);
                cols[c].forEach(x => { if (x && x.id) enServidor.add(c + '/' + x.id); });
            });
            if (typeof data.version === 'number') version = data.version;
            ajeno = false;
            return { cols, perfil: data.perfil || null, integ: data.integ || null, reservas: Array.isArray(data.reservas) ? data.reservas : [] };
        },

        guardar(col, id, data, campos) {
            const k = col + '/' + id;
            return escribir(async () => {
                let r;
                if (campos && enServidor.has(k)) {
                    try {
                        r = await api.patch(`/agendas-v2/${col}/${id}`, campos);
                    } catch (e) {
                        if (estado(e) !== 404) throw e;
                        // El servidor no lo tiene (lo borró otro, o nunca llegó): va entero.
                        enServidor.delete(k);
                        r = await api.put(`/agendas-v2/${col}/${id}`, data);
                    }
                } else {
                    r = await api.put(`/agendas-v2/${col}/${id}`, data);
                }
                enServidor.add(k);
                return r;
            });
        },

        borrar(col, id) {
            const k = col + '/' + id;
            enServidor.delete(k);
            return escribir(async () => {
                try { return await api.delete(`/agendas-v2/${col}/${id}`); } catch (e) {
                    if (estado(e) === 404) return null; // ya no estaba
                    throw e;
                }
            });
        },

        // El perfil es del usuario de la sesión: no sube la versión compartida.
        async guardarPerfil(perfil) {
            try { const { data } = await api.put('/agendas-v2/perfil', perfil); return data; } catch (e) { throw errorDeApi(e); }
        },

        guardarInteg(integ) {
            return escribir(() => api.put('/agendas-v2/integraciones', integ));
        },

        // Closers y setters reales de la app (Team suma personas solo desde acá).
        async usuarios() {
            try { const { data } = await api.get('/agendas-v2/usuarios'); return Array.isArray(data && data.usuarios) ? data.usuarios : []; } catch (e) { throw errorDeApi(e); }
        },

        async crearReserva() {
            const e = new Error('Con la API, las reservas se crean solo desde la página pública del lead (POST /api/agendas-v2/publico/reservas).');
            e.code = 'no_soportado';
            throw e;
        },

        async cancelarReserva(id) {
            const data = await escribir(() => api.post(`/agendas-v2/reservas/${id}/cancelar`));
            return data ? data.reserva : null;
        },

        alCambiar(cb) {
            let vivo = true, pidiendo = false;
            const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
            async function consultar() {
                // Con una escritura nuestra en vuelo, la versión nueva todavía no es "conocida": se espera a la próxima.
                if (!vivo || pidiendo || !visible() || enVuelo > 0) return;
                pidiendo = true;
                try {
                    const { data } = await api.get('/agendas-v2/version', { skipBugReport: true });
                    const v = data ? data.version : undefined;
                    if (!vivo || typeof v !== 'number' || enVuelo > 0) return;
                    if (v !== version || ajeno) {
                        version = v;
                        ajeno = false;
                        cb();
                    }
                } catch { /* sin red: se reintenta en la próxima vuelta */ } finally {
                    pidiendo = false;
                }
            }
            const t = setInterval(consultar, CADA);
            const alVolver = () => { if (visible()) consultar(); };
            document.addEventListener('visibilitychange', alVolver);
            return () => {
                vivo = false;
                clearInterval(t);
                document.removeEventListener('visibilitychange', alVolver);
            };
        },
    };
}
