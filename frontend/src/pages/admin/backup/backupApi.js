import api from '../../../services/api';

// Respaldo de la base (admin u operador). El backend pide, además, la clave de la variable de entorno
// BACKUP_SECRET_KEY: la escribe la persona en la pantalla y solo vive en el estado del componente. NUNCA va
// escrita en el código (estuvo en el bundle público de la web) ni se guarda en localStorage/sessionStorage.
// Viaja en el header X-Backup-Key (en la ruta quedaba en los logs de acceso). La restauración ya no se hace
// desde la web: ver docs/seguridad_despliegue.md.

// Solo caracteres seguros en un header (una hexadecimal de `secrets.token_hex(32)` los cumple).
const CLAVE_VALIDA = /^[A-Za-z0-9._~-]+$/;

export const LARGO_MINIMO_DE_CLAVE = 20;

// Devuelve el problema de la clave escrita, o null si se puede usar.
export const problemaDeLaClave = (clave) => {
    if (!clave) return 'Escribe la clave de respaldo (la variable BACKUP_SECRET_KEY de Railway).';
    if (!CLAVE_VALIDA.test(clave)) {
        return 'La clave solo puede llevar letras, números y los símbolos . _ ~ - (usa una hexadecimal).';
    }
    if (clave.length < LARGO_MINIMO_DE_CLAVE) {
        return `La clave debe tener al menos ${LARGO_MINIMO_DE_CLAVE} caracteres.`;
    }
    return null;
};

const conClave = (clave) => ({ headers: { 'X-Backup-Key': clave } });

// Una copia de toda la base puede tardar bastante más que el resto de peticiones.
const QUINCE_MINUTOS = 15 * 60 * 1000;

export const obtenerVistaPrevia = (clave) => api.get('/backup/preview', conClave(clave));

// pg_dump en formato custom (.dump): se restaura con pg_restore, no se abre como texto.
export const descargarBackup = (clave) =>
    api.get('/backup/export', { ...conClave(clave), responseType: 'blob', timeout: QUINCE_MINUTOS });

// Mensaje legible de un error de axios. Con responseType 'blob' el cuerpo del error llega como Blob.
export const mensajeDeError = async (error) => {
    const cuerpo = error?.response?.data;
    let datos = cuerpo;
    if (cuerpo instanceof Blob) {
        try {
            datos = JSON.parse(await cuerpo.text());
        } catch {
            datos = null;
        }
    }
    const estado = error?.response?.status;
    if (estado === 403 && datos?.message?.includes('Invalid secret key')) return 'La clave de respaldo no es correcta.';
    if (estado === 403) return 'Solo un admin u operador puede usar esta función.';
    if (estado === 503) return datos?.message || 'La función está deshabilitada: falta BACKUP_SECRET_KEY en el servidor.';
    return datos?.message || error?.message || 'No se pudo completar la operación.';
};
