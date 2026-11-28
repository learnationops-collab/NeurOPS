import api from '../../../services/api';

// «Pedir actualización» (ADR-W275).
const conAudio = (campo, texto, audio) => {
    const form = new FormData();
    if (texto) form.append(campo, texto);
    if (audio) form.append('audio', audio, `audio.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`);
    return form;
};

export const listarPedidos = (appt) => api.get(`/ficha/${appt}/pedidos`).then(({ data }) => data);
export const pedirActualizacion = (appt, mensaje, audio) => api.post(`/ficha/${appt}/pedidos`, conAudio('mensaje', mensaje, audio));
export const responderPedido = (id, texto, audio) => api.post(`/ficha/pedidos/${id}/respuesta`, conAudio('texto', texto, audio));
export const bajarAudio = (id, cual) => api.get(`/ficha/pedidos/${id}/audio/${cual}`, { responseType: 'blob' }).then(({ data }) => data);
