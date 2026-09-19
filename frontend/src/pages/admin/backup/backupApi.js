import api from '../../../services/api';

// Respaldo y restauración de la base (solo admin). El backend pide, además de ser admin, la clave de la
// variable de entorno BACKUP_SECRET_KEY: la escribe la persona en la pantalla y solo vive en el estado del
// componente. NUNCA va escrita en el código (estuvo en el bundle público de la web) ni se guarda en
// localStorage/sessionStorage.

// La clave viaja como un segmento de la ruta: solo caracteres que no necesitan escaparse (una hexadecimal de
// `secrets.token_hex(32)` los cumple). Con una barra o un % el servidor no reconocería la ruta.
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

const ruta = (accion, clave) => `/backup/${accion}/${encodeURIComponent(clave)}`;

// Una copia de toda la base o su restauración pueden tardar bastante más que el resto de peticiones.
const CINCO_MINUTOS = 5 * 60 * 1000;

export const obtenerVistaPrevia = (clave) => api.get(ruta('secret-backup-preview', clave));

export const descargarBackup = (clave) =>
    api.get(ruta('secret-backup-export', clave), { responseType: 'blob', timeout: CINCO_MINUTOS });

export const restaurarBackup = (clave, archivo) => {
    const formulario = new FormData();
    formulario.append('file', archivo);
    return api.post(ruta('secret-restore-import', clave), formulario, { timeout: CINCO_MINUTOS });
};

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
    if (estado === 403) return 'Solo un usuario admin puede usar esta función.';
    if (estado === 503) return datos?.message || 'La función está deshabilitada: falta BACKUP_SECRET_KEY en el servidor.';
    return datos?.message || error?.message || 'No se pudo completar la operación.';
};
