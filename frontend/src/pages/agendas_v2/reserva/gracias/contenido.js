// De dónde sale lo que ve el lead en la página de gracias y cómo se reproduce cada video.
//
// Una página de gracias es un recurso de Thalamus (colección `gracias`, como los formularios). El
// servidor la entrega lista para mostrar en /api/agendas-v2/publico/gracias/<id>:
//   {id, video: {tipo: 'archivo'|'link', src} | null, plan: idem | null, segundos, casos: [...]}
// Los casos son los de la Academia (Muro de Honor): {nombre, meta, resumen, cita, foto, video}.

import api from '../../../../services/api';

export const RUTA_GRACIAS = '/agendas-v2/agenda/gracias';
export const rutaGracias = (id) => RUTA_GRACIAS + '/' + encodeURIComponent(id);
export const rutaPlan = (id) => rutaGracias(id) + '/plan';

// Los videos de Learnation con los que arranca una página nueva (los de la referencia).
export const VIDEOS_INICIALES = {
    video: 'https://www.loom.com/share/1b90b8d7009b462cbeba2b9440236c97',
    plan: 'https://www.loom.com/share/ecb462c790af4f8b8987c3f0ed19914a',
};

// Link de Loom, YouTube, Vimeo o Drive → la URL para embeberlo, o '' si no lo reconoce.
export function embedDe(url) {
    let u;
    try { u = new URL(String(url || '')); } catch { return ''; }
    if (u.protocol !== 'https:') return '';
    const host = u.hostname.replace(/^www\./, ''), partes = u.pathname.split('/').filter(Boolean);
    if (host === 'loom.com' && ['share', 'embed'].includes(partes[0]) && partes[1]) {
        return `https://www.loom.com/embed/${partes[1]}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
        const lista = u.searchParams.get('list');
        const id = host === 'youtu.be' ? partes[0] : partes[0] === 'watch' ? u.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(partes[0]) ? partes[1] : '';
        if (id && id !== 'videoseries') return `https://www.youtube.com/embed/${id}?rel=0`;
        if (lista) return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(lista)}&rel=0`;
        return '';
    }
    if (host === 'vimeo.com' && /^\d+$/.test(partes[0] || '')) return `https://player.vimeo.com/video/${partes[0]}`;
    if (host === 'player.vimeo.com' && partes[0] === 'video') return u.href;
    if (host === 'drive.google.com' && partes[0] === 'file' && partes[1] === 'd' && partes[2]) {
        return `https://drive.google.com/file/d/${partes[2]}/preview`;
    }
    return '';
}

// {tipo: 'archivo'|'link', src} del servidor → lo que necesita el reproductor, o null.
export function reproductor(v) {
    if (!v || !v.src) return null;
    if (v.tipo === 'archivo') return { tipo: 'archivo', src: v.src };
    const src = embedDe(v.src);
    return src ? { tipo: 'iframe', src } : null;
}

// Rechaza con code 'no_disponible' (no existe) o 'fallo' (red).
export async function cargarGracias(id) {
    try {
        const { data } = await api.get(`/agendas-v2/publico/gracias/${encodeURIComponent(id)}`, { timeout: 20000, skipBugReport: true, skipAuthError: true });
        if (!data || !data.gracias) throw Object.assign(new Error('Respuesta incompleta'), { response: { status: 404 } });
        return data.gracias;
    } catch (e) {
        const st = e && e.response ? e.response.status : null;
        throw Object.assign(new Error('No se pudo cargar'), { code: st === 404 ? 'no_disponible' : 'fallo' });
    }
}
