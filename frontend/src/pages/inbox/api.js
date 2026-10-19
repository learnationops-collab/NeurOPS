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
    // { desde, hasta, campanas: [{ ..., metricas }] } (app/automatizaciones/api_campanas.py)
    campanas: (desde, hasta) => api.get('/inbox/campanas', { params: { desde, hasta } }).then(datos),
    crearCampana: (campana) => api.post('/inbox/campanas', campana).then(datos),
    guardarCampana: (id, campana) => api.put(`/inbox/campanas/${id}`, campana).then(datos),
    borrarCampana: (id) => api.delete(`/inbox/campanas/${id}`),
    campanasMeta: () => api.get('/inbox/campanas/meta').then((r) => r.data.campanas),
    catalogo: () => api.get('/inbox/catalogo').then((r) => r.data.mensajes),
    setters: () => api.get('/inbox/setters').then((r) => r.data.setters),
};
