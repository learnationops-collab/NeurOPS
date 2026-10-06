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
//   horarios({ctx, evento, resp, tz, prueba, signal})
//       ctx: lo que pide asignacion() (local). evento/resp/tz: lo que pide el servidor. signal: para cancelar.
//       → {slots: [{t, p}], aviso, …}   (en la API p es null: el servidor no dice de quién es cada horario)
//   reservar({lead, ctx, evento, form, asig, slot, origen, setter})  → Promise
//       slot null = lead que no califica (se registra sin horario). Rechaza con code 'ocupado' (otro
//       tomó el horario), 'ya_tiene' (el lead ya tiene una agenda próxima, en err.agenda.inicio: se le
//       pregunta y se repite con siYaTiene 'reprogramar' o 'adicional'), 'limite' o 'fallo'.
//   cargarEvento(funnelSlug, eventoSlug)   (solo API) → {evento, form, funnel}; rechaza 'no_disponible' o 'fallo'

import api from '../../../services/api';
import { asignacion } from '../core/asignacion';
import { buscar } from '../core/datos';
import { armarReserva } from '../core/reserva';
import { opcionesDeOcupacion } from '../data/ocupacion';

export function proveedorLocal(d, reservas = [], crear = null) {
    const asignar = (ctx, prueba) => asignacion(ctx, d, { ...opcionesDeOcupacion(reservas), prueba });
    return {
        tipo: 'local', sinc: true, d,
        horarios({ ctx, prueba = false }) { return asignar(ctx, prueba); },
        async reservar({ lead, ctx, evento, form, asig, slot, origen, setter }) {
            if (!crear) throw Object.assign(new Error('Esta vista no agenda'), { code: 'fallo' });
            const funnel = evento ? buscar(d, 'funnels', evento.funnel) || null : null;
            const a = asig || asignar(ctx, false);
            return crear(armarReserva({ lead, evento, funnel, form, asig: a, slot, origen, setter }));
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

        async horarios({ evento, resp, tz, signal }) {
            try {
                const { data } = await api.post(`/agendas-v2/publico/eventos/${seg(evento.id)}/horarios`, { resp, tz }, { ...OPC, signal });
                const ts = (data && Array.isArray(data.slots) ? data.slots : []).filter(t => Number.isFinite(t)).sort((a, b) => a - b);
                return { slots: ts.map(t => ({ t, p: null })), aviso: '' };
            } catch (e) { throw errorPublico(e); }
        },

        async reservar({ lead, evento, slot, origen, siYaTiene }) {
            const cuerpo = {
                evento_id: evento.id, resp: lead.resp, pais: lead.pais, tz: lead.tz,
                inicio: slot ? new Date(slot.t).toISOString() : null, origen: origen || '',
                ...(siYaTiene ? { si_ya_tiene: siYaTiene } : {}),
            };
            try {
                const { data } = await api.post('/agendas-v2/publico/reservas', cuerpo, OPC);
                return data;
            } catch (e) { throw errorPublico(e); }
        },
    };
}
