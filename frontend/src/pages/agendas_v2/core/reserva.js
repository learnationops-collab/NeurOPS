// Contrato de la reserva: lo que la pantalla del lead manda al confirmar y lo que el backend
// (app/agendas_v2/) tiene que guardar y después volcar en FinancialAgenda + Appointment.

import { conOpciones, paisDe } from './catalogos';
import { calificar } from './formulario';

export const VERSION_CONTRATO = 1;

// Número en formato internacional (+591…). Si el lead ya escribió el prefijo, se respeta.
export function telefonoE164(paisC, tel) {
    const crudo = String(tel || '').trim();
    if (!crudo) return '';
    const dig = crudo.replace(/\D/g, '');
    if (crudo.startsWith('+')) return '+' + dig;
    const pref = paisDe(paisC).d.replace(/\D/g, '');
    if (crudo.startsWith('00') && dig.slice(2).startsWith(pref)) return '+' + dig.slice(2);
    return '+' + pref + dig.replace(/^0+/, '');
}

export function textoRespuesta(q, v, paisC) {
    if (!v) return '';
    if (conOpciones(q.tipo)) { const o = q.opciones.find(x => x.id === v); return o ? o.texto : ''; }
    if (q.tipo === 'telefono') return paisDe(paisC).d + ' ' + v;
    if (q.tipo === 'instagram') return '@' + v;
    return v;
}

/**
 * Arma el cuerpo de POST /api/agendas-v2/reservas (y de una agenda descalificada, con slot null).
 * Guarda una copia de cada pregunta y respuesta para que la agenda se lea igual aunque después
 * se edite el formulario.
 *
 * lead: {preguntas, resp, pais, tz}; evento: evento publicado; asig: resultado de asignacion();
 * slot: {t, p} elegido o null; origen: slug de ?o= o ''.
 */
export function armarReserva({ lead, evento, funnel, form, asig, slot, origen, setter }) {
    const { preguntas, resp, pais, tz } = lead;
    const val = (k) => String(resp['c-' + k] || '');
    const respuestas = preguntas.filter(q => !q.id.startsWith('c-')).map(q => {
        const o = conOpciones(q.tipo) ? q.opciones.find(x => x.id === resp[q.id]) : null;
        return {
            pregunta_id: q.id, pregunta: q.titulo, tipo: q.tipo, respuesta: textoRespuesta(q, resp[q.id], pais),
            opcion_id: o ? o.id : null, puntos: o ? o.puntos : null, peso: q.peso, descalifica: !!(o && o.descalifica),
        };
    });
    const descalificada = respuestas.some(r => r.descalifica);
    return {
        version: VERSION_CONTRATO,
        evento_id: evento.id, evento_slug: evento.slug, funnel_id: funnel ? funnel.id : '', funnel_slug: funnel ? funnel.slug : '',
        funnel_tipo: funnel ? (funnel.tipo || 'otro') : '',
        formulario_id: form ? form.id : '',
        inicio: slot ? new Date(slot.t).toISOString() : null,
        duracion_min: evento.duracion,
        closer_id: slot ? slot.p : null,
        prioridad_id: asig && asig.grupo ? asig.grupo.id : null,
        prioridad_regla_id: asig ? asig.grupoRegla || null : null,
        regla_idx: asig ? asig.reglaIdx : null,
        desborde: !!(asig && asig.desborde),
        nota: calificar(preguntas, resp),
        descalificada,
        origen: origen || '',
        setter_id: setter || null,
        lead: {
            nombre: val('nombre'), telefono: telefonoE164(pais, val('telefono')), email: val('email').toLowerCase(),
            instagram: val('instagram'), pais, tz,
        },
        respuestas,
    };
}
