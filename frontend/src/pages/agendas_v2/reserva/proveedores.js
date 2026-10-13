// De dónde saca la pantalla del lead los horarios y dónde agenda. Dos proveedores con la misma forma:
//
//   proveedorLocal(d, reservas, crear?)  calcula la asignación en el navegador, al instante (sinc: true).
//       Lo usan la prueba y la vista previa de Thalamus (sin crear: no se agenda nada) y la página
//       pública cuando los datos viven en este navegador (crear: el crearReserva del adaptador local).
//   proveedorApi()                       la página pública contra /api/agendas-v2/publico (sinc: false).
//       El servidor calcula los horarios y la asignación; el navegador no ve closers ni agendas.
//
// Forma común:
//   sinc                       true: horarios() devuelve la asignación; false: una promesa de {slots}
//   d                          datos para mostrar nombres (solo local; en la API, null)
//   horarios({ctx, evento, resp, tz, pais, guardadas, prueba, signal})
//       ctx: lo que pide asignacion() (local). evento/resp/tz/pais: lo que pide el servidor. signal: para cancelar.
//       guardadas: el lead confirmó sus respuestas guardadas (el servidor segmenta con esas).
//       → {slots: [{t, p}], aviso, …}   (en la API p es null: el servidor no dice de quién es cada horario)
//   reservar({lead, ctx, evento, form, asig, slot, origen, setter})  → Promise
//       slot null = lead que no califica (se registra sin horario). Rechaza con code 'ocupado' (otro
//       tomó el horario), 'ya_tiene' (el lead ya tiene una agenda próxima, en err.agenda.inicio: se le
//       pregunta y se repite con siYaTiene 'reprogramar' o 'adicional'), 'limite' o 'fallo'.
//   avance({evento, resp, pais, origen, enCalendario, datosGuardados, respuestasGuardadas})  (solo API) el lead avanzó un paso
//       después de dejar sus datos: queda para Stats (dónde se caen). Nunca falla ni frena al lead.
//   cargarEvento(funnelSlug, eventoSlug)   (solo API) → {evento, form, funnel}; rechaza 'no_disponible' o 'fallo'
//   conocido({evento, form, email | telefono, pais})  → Promise<{conocido, completos, datos: {nombre, nombre_completo,
//       telefono, instagram} (tapados), proxima: {inicio (ms)} | null, respuestas: {enviado, no, url} | {enviado, resp}
//       | null, resp?}>. El lead que ya agendó antes (por su correo o su WhatsApp): no se le piden de nuevo sus
//       datos y, si ya respondió este mismo formulario, solo confirma sus respuestas. resp (solo local): las
//       respuestas completas; en la API las pone el servidor y respuestas trae solo cómo terminaría (no, url).
//   reservar(...) devuelve {reserva: {…, consultor: {nombre, color}}} en la API y la reserva en local.

import api from '../../../services/api';
import { asignacion } from '../core/asignacion';
import { buscar, sesionDe } from '../core/datos';
import { conOpciones } from '../core/catalogos';
import { limpiarRespuesta, validarRespuesta } from '../core/formulario';
import { armarReserva, telefonoE164 } from '../core/reserva';
import { opcionesDeOcupacion } from '../data/ocupacion';

// Lo que el lead que vuelve ve de sus datos: su nombre (se precarga) y el contacto tapado (igual que el servidor).
export function datosTapados(lead) {
    const tel = String(lead.telefono || '').replace(/\D/g, ''), ig = String(lead.instagram || '');
    return {
        nombre: String(lead.nombre || '').split(' ')[0],
        nombre_completo: String(lead.nombre || ''),
        telefono: tel ? '+' + tel.slice(0, 2) + ' ••• ' + tel.slice(-3) : '',
        instagram: ig ? '@' + ig.slice(0, 2) + '•••' : '',
    };
}

// Mismo margen que el servidor: una agenda que empezó hace menos de 2 h todavía cuenta como próxima.
const MARGEN_PROXIMA = 2 * 3600000;

// Las respuestas de su último envío, si fue a este mismo formulario y no cambió de preguntas (como el servidor).
function respuestasPrevias(form, ultima) {
    const qs = (form && form.preguntas) || [];
    if (!qs.length || !ultima || !form.id || ultima.formulario_id !== form.id) return null;
    const previas = new Map((ultima.respuestas || []).map(r => [r.pregunta_id, r]));
    if (previas.size !== qs.length || qs.some(q => !previas.has(q.id))) return null;
    const resp = {};
    for (const q of qs) {
        const r = previas.get(q.id);
        const v = conOpciones(q.tipo) ? r.opcion_id || '' : limpiarRespuesta(q, r.respuesta);
        if ((v && conOpciones(q.tipo) && !q.opciones.some(o => o.id === v)) || validarRespuesta(q, v)) return null;
        if (v) resp[q.id] = v;
    }
    return resp;
}

export function proveedorLocal(d, reservas = [], crear = null) {
    const asignar = (ctx, prueba) => asignacion(ctx, d, { ...opcionesDeOcupacion(reservas), prueba });
    return {
        tipo: 'local', sinc: true, d,
        horarios({ ctx, prueba = false }) { return asignar(ctx, prueba); },
        async conocido({ form, email, telefono, pais }) {
            const mail = String(email || '').trim().toLowerCase();
            const tel = telefono ? telefonoE164(pais, telefono).replace(/\D/g, '').slice(-8) : '';
            const esSuya = (l) => (mail ? String(l.email || '').toLowerCase() === mail
                : tel.length === 8 && String(l.telefono || '').replace(/\D/g, '').endsWith(tel));
            const suyas = reservas.filter(r => r.lead && esSuya(r.lead));
            if (!suyas.length) return { conocido: false };
            const ultima = suyas[suyas.length - 1], lead = ultima.lead, ahora = Date.now();
            const prox = suyas.filter(r => r.estado === 'agendada' && r.inicio_ms != null && r.inicio_ms >= ahora - MARGEN_PROXIMA)
                .sort((a, b) => a.inicio_ms - b.inicio_ms)[0];
            const resp = {};
            if (lead.nombre) resp['c-nombre'] = lead.nombre;
            if (lead.telefono) resp['c-telefono'] = lead.telefono;
            if (lead.instagram) resp['c-instagram'] = lead.instagram;
            if (lead.email) resp['c-email'] = lead.email;
            const previas = respuestasPrevias(form, ultima);
            return {
                conocido: true, completos: !!(lead.nombre && lead.telefono && lead.email), datos: datosTapados(lead),
                proxima: prox ? { inicio: prox.inicio_ms } : null, resp, respuestas: previas ? { enviado: null, resp: previas } : null,
            };
        },
        async reservar({ lead, ctx, evento, form, asig, slot, origen, setter }) {
            if (!crear) throw Object.assign(new Error('Esta vista no agenda'), { code: 'fallo' });
            const funnel = evento ? buscar(d, 'funnels', evento.funnel) || null : null;
            const a = asig || asignar(ctx, false);
            // Como el servidor: la reserva lleva la sesión del closer que tocó (lo suyo o la propuesta).
            const conSesion = slot && evento ? (([dur, margen]) => ({ ...slot, dur, margen }))(sesionDe(buscar(d, 'personas', slot.p), evento.id, evento.duracion, evento.margen)) : slot;
            return crear(armarReserva({ lead, evento, funnel, form, asig: a, slot: conSesion, origen, setter }));
        },
    };
}

// Prueba por segmento (Thalamus): los horarios de una prioridad (grupo), salteando el formulario. No agenda.
// Con la API los pide al servidor (los mismos que vería el lead: closers que pueden recibir, sus agendas
// y su Google Calendar) y dice de quién es cada uno; en modo local los calcula acá.
export function proveedorPrueba(d, reservas, eventoId, grupo, conApi) {
    if (!conApi) {
        const local = proveedorLocal(d, reservas);
        return { ...local, horarios({ ctx, prueba }) { return local.horarios({ ctx: { ...ctx, reglas: [], resto: grupo }, prueba }); } };
    }
    return {
        tipo: 'prueba', sinc: false, d,
        async horarios({ signal }) {
            try {
                const { data } = await api.post(`/agendas-v2/eventos/${seg(eventoId)}/prueba`, { grupo }, { signal });
                const slots = (data && Array.isArray(data.slots) ? data.slots : []).filter(x => x && Number.isFinite(x.t)).map(x => ({ t: x.t, p: x.p || null }));
                return { slots, aviso: '', regla: data.regla || '', desborde: !!data.desborde, grupo: buscar(d, 'grupos', data.grupo) || null };
            } catch (e) { throw errorPublico(e); }
        },
    };
}

// Error de axios → {code} que entiende la pantalla del lead.
function errorPublico(e) {
    const st = e && e.response ? e.response.status : null;
    const err = new Error((e && e.message) || 'Falló el pedido');
    err.status = st;
    if (e && (e.code === 'ERR_CANCELED' || e.name === 'CanceledError')) err.code = 'cancelado';
    else if (st === 409 && e.response.data && e.response.data.code === 'ya_tiene') {
        err.code = 'ya_tiene';
        err.agenda = e.response.data.agenda || null;
    } else if (st === 409) err.code = 'ocupado';
    else if (st === 429) err.code = 'limite';
    else if (st === 404) err.code = 'no_disponible';
    else err.code = 'fallo';
    return err;
}

// Al lead no se le ofrece "Reportar error" si se cae la red: ya ve su propio aviso.
const OPC = { skipBugReport: true, skipAuthError: true };
const seg = (x) => encodeURIComponent(String(x || ''));

export function proveedorApi() {
    return {
        tipo: 'api', sinc: false, d: null,

        async cargarEvento(funnelSlug, eventoSlug) {
            try {
                const { data } = funnelSlug
                    ? await api.get(`/agendas-v2/publico/eventos/${seg(funnelSlug)}/${seg(eventoSlug)}`, OPC)
                    : await api.get(`/agendas-v2/publico/eventos/${seg(eventoSlug)}`, OPC);
                if (!data || !data.evento || !data.form) throw Object.assign(new Error('Respuesta incompleta'), { response: { status: 404 } });
                return data;
            } catch (e) { throw errorPublico(e); }
        },

        async horarios({ evento, resp, tz, pais, guardadas, signal }) {
            try {
                const cuerpo = { resp, tz, pais, ...(guardadas ? { respuestas_guardadas: true } : {}) };
                const { data } = await api.post(`/agendas-v2/publico/eventos/${seg(evento.id)}/horarios`, cuerpo, { ...OPC, signal });
                const ts = (data && Array.isArray(data.slots) ? data.slots : []).filter(t => Number.isFinite(t)).sort((a, b) => a - b);
                return { slots: ts.map(t => ({ t, p: null })), aviso: '' };
            } catch (e) { throw errorPublico(e); }
        },

        async conocido({ evento, email, telefono, pais }) {
            try {
                const cuerpo = email ? { email } : { telefono, pais };
                const { data } = await api.post(`/agendas-v2/publico/eventos/${seg(evento.id)}/conocido`, cuerpo, OPC);
                if (!data || !data.conocido) return { conocido: false };
                return { ...data, proxima: data.proxima ? { inicio: Date.parse(data.proxima.inicio) } : null };
            } catch (e) { throw errorPublico(e); }
        },

        avance({ evento, resp, pais, origen, enCalendario, datosGuardados, respuestasGuardadas }) {
            const cuerpo = {
                resp, pais, origen: origen || '', en_calendario: !!enCalendario,
                ...(datosGuardados ? { datos_guardados: true } : {}), ...(respuestasGuardadas ? { respuestas_guardadas: true } : {}),
            };
            return api.post(`/agendas-v2/publico/eventos/${seg(evento.id)}/avance`, cuerpo, OPC).catch(() => { /* solo es para Stats */ });
        },

        async reservar({ lead, evento, slot, origen, siYaTiene, datosGuardados, respuestasGuardadas }) {
            const cuerpo = {
                evento_id: evento.id, resp: lead.resp, pais: lead.pais, tz: lead.tz,
                inicio: slot ? new Date(slot.t).toISOString() : null, origen: origen || '',
                ...(siYaTiene ? { si_ya_tiene: siYaTiene } : {}),
                ...(datosGuardados ? { datos_guardados: true } : {}),
                ...(respuestasGuardadas ? { respuestas_guardadas: true } : {}),
            };
            try {
                const { data } = await api.post('/agendas-v2/publico/reservas', cuerpo, OPC);
                return data;
            } catch (e) { throw errorPublico(e); }
        },
    };
}
