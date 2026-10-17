// Llamadas del área Inbox a /api/inbox (app/automatizaciones/api.py).
import api from '../../services/api';

const datos = (r) => r.data;

export const inboxApi = {
    estado: () => api.get('/inbox/estado').then(datos),
    flujos: () => api.get('/inbox/flujos').then((r) => r.data.flujos),
    flujo: (id) => api.get(`/inbox/flujos/${id}`).then(datos),
    crearFlujo: (nombre, grafo) => api.post('/inbox/flujos', grafo ? { nombre, grafo } : { nombre }).then(datos),
    guardarFlujo: (id, cambios) => api.put(`/inbox/flujos/${id}`, cambios).then(datos),
    publicarFlujo: (id) => api.post(`/inbox/flujos/${id}/publicar`).then(datos),
    pausarFlujo: (id) => api.post(`/inbox/flujos/${id}/pausar`).then(datos),
    activarFlujo: (id) => api.post(`/inbox/flujos/${id}/activar`).then(datos),
    borrarFlujo: (id) => api.delete(`/inbox/flujos/${id}`),
    // { conversaciones, mediana_respuesta }
    conversaciones: (buscar) => api.get('/inbox/conversaciones', { params: buscar ? { buscar } : {} }).then(datos),
    conversacion: (id) => api.get(`/inbox/conversaciones/${id}`).then(datos),
};
