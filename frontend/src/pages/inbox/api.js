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
    // Solo los textos de la versión publicada (app/automatizaciones/api_mensajes.py)
    mensajesFlujo: (id) => api.get(`/inbox/flujos/${id}/mensajes`).then(datos),
    guardarMensajes: (id, cambios) => api.put(`/inbox/flujos/${id}/mensajes`, { cambios }).then(datos),
    // { conversaciones, mediana_respuesta, medianas_setters }
    conversaciones: (buscar, limite) => api.get('/inbox/conversaciones', { params: { ...(buscar ? { buscar } : {}), ...(limite ? { limite } : {}) } }).then(datos),
    conversacion: (id) => api.get(`/inbox/conversaciones/${id}`).then(datos),
    // Acciones del setter (app/automatizaciones/api_acciones.py)
    pasos: (id) => api.get(`/inbox/conversaciones/${id}/pasos`).then(datos),
    moverEnFlujo: (id, cuerpo) => api.post(`/inbox/conversaciones/${id}/flujo`, cuerpo).then(datos),
    bot: (id, pausado) => api.post(`/inbox/conversaciones/${id}/bot`, { pausado }).then(datos),
    // Etiquetas (app/automatizaciones/api_etiquetas.py): { grupos: [{ id, name, color, exclusive, tags }], sueltas }
    etiquetas: () => api.get('/inbox/etiquetas').then(datos),
    crearGrupoEtiquetas: (grupo) => api.post('/inbox/etiquetas/grupos', grupo).then(datos),
    ponerEtiqueta: (id, etiqueta) => api.post(`/inbox/conversaciones/${id}/etiquetas`, etiqueta).then((r) => r.data.etiquetas),
    sacarEtiqueta: (id, tagId) => api.delete(`/inbox/conversaciones/${id}/etiquetas/${tagId}`).then((r) => r.data.etiquetas),
    // Lo que el setter trabaja sobre la conversación (app/automatizaciones/api_trabajo.py)
    leido: (id) => api.post(`/inbox/conversaciones/${id}/leido`),
    asignar: (id, setterId) => api.post(`/inbox/conversaciones/${id}/asignar`, { setter_id: setterId }).then(datos),
    moverEtapa: (id, etapa) => api.put(`/inbox/conversaciones/${id}/etapa`, { etapa }).then(datos),
    corregirVariable: (id, campo, valor) => api.put(`/inbox/conversaciones/${id}/variables`, { campo, valor }).then(datos),
    crearNota: (id, texto) => api.post(`/inbox/conversaciones/${id}/notas`, { texto }).then(datos),
    crearTarea: (id, tarea) => api.post(`/inbox/conversaciones/${id}/tareas`, tarea).then(datos),
    cambiarTarea: (tareaId, hecha) => api.put(`/inbox/tareas/${tareaId}`, { hecha }).then(datos),
    misTareas: () => api.get('/inbox/tareas').then((r) => r.data.tareas),
    // Biblioteca del equipo (app/automatizaciones/api_biblioteca.py)
    rapidas: () => api.get('/inbox/respuestas-rapidas').then((r) => r.data.respuestas),
    crearRapida: (r) => api.post('/inbox/respuestas-rapidas', r).then(datos),
    borrarRapida: (rid) => api.delete(`/inbox/respuestas-rapidas/${rid}`),
    audios: () => api.get('/inbox/audios').then((r) => r.data.audios),
    subirAudio: (form) => api.post('/inbox/audios', form).then(datos),
    archivoAudio: (aid) => api.get(`/inbox/audios/${aid}/archivo`, { responseType: 'blob' }).then(datos),
    borrarAudio: (aid) => api.delete(`/inbox/audios/${aid}`),
    // { desde, hasta, campanas: [{ ..., metricas }] } (app/automatizaciones/api_campanas.py)
    campanas: (desde, hasta) => api.get('/inbox/campanas', { params: { desde, hasta } }).then(datos),
    crearCampana: (campana) => api.post('/inbox/campanas', campana).then(datos),
    guardarCampana: (id, campana) => api.put(`/inbox/campanas/${id}`, campana).then(datos),
    borrarCampana: (id) => api.delete(`/inbox/campanas/${id}`),
    campanasMeta: () => api.get('/inbox/campanas/meta').then((r) => r.data.campanas),
    catalogo: () => api.get('/inbox/catalogo').then((r) => r.data.mensajes),
    setters: () => api.get('/inbox/setters').then((r) => r.data.setters),
};
