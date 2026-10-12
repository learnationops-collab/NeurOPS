// Subida de los videos de las páginas de gracias al volumen del servidor (app/agendas_v2/videos.py).
//
// Va por partes de PARTE bytes: cada pedido es corto (el servidor corta a los 120 s) y una subida
// cortada sigue desde lo que llegó. Si el servidor dice que se desfasó, devuelve lo recibido y se sigue
// desde ahí; un error de red se reintenta unas veces antes de rendirse.

import api from '../../../services/api';
import { errorDeApi } from './adaptadorApi';

export const TIPOS_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
export const TAMANO_MAX = 500 * 1024 * 1024;
const PARTE = 4 * 1024 * 1024;
const REINTENTOS = 3;

// Texto para el director si el archivo no sirve, o '' si sirve.
export function problemaVideo(file) {
    if (!file) return 'Elegí un video.';
    if (!TIPOS_VIDEO.includes(file.type)) return 'Subí un video MP4, WebM o MOV.';
    if (file.size > TAMANO_MAX) return 'El video puede pesar hasta 500 MB.';
    if (!file.size) return 'Ese archivo está vacío.';
    return '';
}

/**
 * Sube `file` y devuelve {id, nombre, ...} cuando el servidor lo tiene completo.
 * onProgreso(0..1); signal (AbortController) la cancela. Rechaza con un error con `code`
 * ('sin_volumen', 'invalido', 'cancelado', 'unavailable', ...) y `message`.
 */
export async function subirVideo(file, { onProgreso = () => {}, signal } = {}) {
    const p = problemaVideo(file);
    if (p) throw Object.assign(new Error(p), { code: 'invalido' });
    let video;
    try {
        ({ data: { video } } = await api.post('/agendas-v2/videos', { nombre: file.name, tamano: file.size, tipo: file.type }, { signal }));
    } catch (e) { throw errorDeApi(e); }
    let desde = 0, fallos = 0;
    onProgreso(0);
    while (desde < file.size) {
        const parte = file.slice(desde, Math.min(desde + PARTE, file.size));
        try {
            const { data } = await api.put(`/agendas-v2/videos/${video.id}?desde=${desde}`, parte, {
                signal, timeout: 110000, headers: { 'Content-Type': 'application/octet-stream' },
            });
            desde = data.video.recibido;
            fallos = 0;
        } catch (e) {
            const err = errorDeApi(e);
            if (err.code === 'cancelado') throw err;
            const recibido = e && e.response && e.response.data ? e.response.data.recibido : undefined;
            if (err.code === 'desfasado' && typeof recibido === 'number') { desde = recibido; continue; }
            const pasajero = err.code === 'unavailable' || (err.status >= 500 && err.code === 'error');
            if (!pasajero || ++fallos > REINTENTOS) throw err;
            await new Promise(r => setTimeout(r, 1500 * fallos));
        }
        onProgreso(desde / file.size);
    }
    return { ...video, recibido: file.size, listo: true };
}

// Borra el archivo del volumen si ninguna otra página de gracias lo usa. `salvo`: la página que lo suelta.
// No falla nunca: un archivo que queda huérfano solo ocupa lugar.
export async function soltarVideo(id, salvo) {
    if (!id) return;
    try { await api.delete(`/agendas-v2/videos/${id}`, { params: { salvo } }); } catch { /* queda en el volumen */ }
}

// URL para ver un video subido (la misma que usa la página pública).
export const urlVideo = (id) => '/api/agendas-v2/publico/videos/' + id;
