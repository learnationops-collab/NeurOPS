// Prueba por segmento: el enlace /agendas-v2?probar=<evento>(&seg=<segmento>) saltea el formulario.
// Se elige con qué segmentación llega el lead y se ve lo que vería él, con un lead de prueba.

import { conOpciones } from '../core/catalogos';
import { buscar } from '../core/datos';
import { NO_CALIFICA } from '../core/formulario';
import { FORM_SOLO_CONTACTO, formDeEvento, versionPublicada } from '../core/eventos';
import { normalForm, preguntasFlujo } from '../core/normalizar';

// Lo que se prueba: la versión publicada (la que ve el lead) o, si nunca se publicó, el borrador.
// Igual que el servidor (servicio.version_para_prueba).
export function versionParaPrueba(d, e) {
    const pub = versionPublicada(e);
    if (pub) return { evento: pub.evento, form: pub.form || (pub.evento.persona ? normalForm('contacto', FORM_SOLO_CONTACTO) : null), version: 'publicada' };
    return { evento: e, form: formDeEvento(d, e), version: 'borrador' };
}

const sinHttps = (u) => String(u || '').replace(/^https?:\/\//i, '');

/**
 * Los destinos posibles de un lead en ese evento, en el orden de las reglas:
 * [{k, tipo: 'grupo'|'url'|'no', grupo?, url?, n, sub}]. k va en el enlace (&seg=).
 *  - grupo: una prioridad (las reglas que mandan ahí y «Todo lo demás» se juntan en una).
 *  - url:   una regla que manda a otra página (no agenda).
 *  - no:    eligió una respuesta que descalifica, o una regla (o «Todo lo demás») lo manda a «No califica».
 */
export function segmentosDe(d, evento, form) {
    if (evento && evento.persona) {
        const p = buscar(d, 'personas', evento.persona);
        return [{ k: 'fijo', tipo: 'grupo', grupo: '', n: 'Llamada con ' + (p ? p.nombre : 'su closer'), sub: 'Closer fijo: este evento no segmenta' }];
    }
    const out = [], porGrupo = new Map(), alNo = [];
    const alGrupo = (id, origen) => {
        if (!porGrupo.has(id)) {
            const g = buscar(d, 'grupos', id);
            const x = { k: 'g-' + id, tipo: 'grupo', grupo: id, n: g ? g.nombre : 'Prioridad borrada', origenes: [] };
            porGrupo.set(id, x);
            out.push(x);
        }
        porGrupo.get(id).origenes.push(origen);
    };
    ((form && form.reglas) || []).forEach((r, i) => {
        if (!r.cond.some(c => c.q && c.ops.length)) return;
        if (r.url) out.push({ k: 'r' + i, tipo: 'url', url: r.url, n: 'Redirige a ' + sinHttps(r.url), sub: 'Regla ' + (i + 1) + ' · no agenda' });
        else if (r.grupo === NO_CALIFICA) alNo.push('Regla ' + (i + 1));
        else if (r.grupo) alGrupo(r.grupo, 'Regla ' + (i + 1));
    });
    if (form && form.resto === NO_CALIFICA) alNo.push('Todo lo demás');
    else if (form && form.resto) alGrupo(form.resto, 'Todo lo demás');
    out.forEach(x => { if (x.origenes) { x.sub = x.origenes.join(' · '); delete x.origenes; } });
    if (!porGrupo.size && !(form && form.resto === NO_CALIFICA)) out.push({ k: 'todos', tipo: 'grupo', grupo: '', n: 'Todos los closers', sub: 'El formulario no manda a ninguna prioridad' });
    const filtra = form && preguntasFlujo(form).some(q => conOpciones(q.tipo) && q.opciones.some(o => o.descalifica && o.texto.trim()));
    if (filtra) alNo.push('Eligió una respuesta que descalifica');
    if (alNo.length) out.push({ k: 'no', tipo: 'no', n: 'No califica', sub: alNo.join(' · ') });
    return out;
}

// El lead de prueba: completa solo las preguntas de contacto que tenga el formulario.
const LEAD_PRUEBA = { 'c-nombre': 'Lead de Prueba', 'c-email': 'prueba@learnation.test', 'c-telefono': '70000000', 'c-instagram': 'leaddeprueba' };
export function respDePrueba(preguntas) {
    const resp = {};
    preguntas.forEach(q => { if (LEAD_PRUEBA[q.id]) resp[q.id] = LEAD_PRUEBA[q.id]; });
    return resp;
}

export function urlPrueba(eventoId, seg = '') {
    return window.location.origin + '/agendas-v2?probar=' + encodeURIComponent(eventoId) + (seg ? '&seg=' + encodeURIComponent(seg) : '');
}
