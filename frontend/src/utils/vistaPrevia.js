import api from '../services/api';

/**
 * Abre una vista previa del backend en una pestaña nueva con un token de dos minutos que solo sirve para eso
 * (/auth/preview-token): el de la sesión no viaja en la URL. La pestaña se abre antes del await porque los
 * navegadores bloquean un window.open() que llega después de una espera.
 */
export const abrirVistaPrevia = async (ruta) => {
    const pestana = window.open('', '_blank');
    try {
        const { data } = await api.post('/auth/preview-token');
        const url = `${ruta}?token=${encodeURIComponent(data.token)}`;
        if (pestana) pestana.location.href = url;
        else window.open(url, '_blank');
    } catch (err) {
        pestana?.close();
        throw err;
    }
};
