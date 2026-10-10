"""Contrato de la reserva: lo que la pantalla del lead manda al confirmar y lo que el backend guarda
y después vuelca en FinancialAgenda + Appointment. Port de core/reserva.js.
"""

import re

from app.agendas_v2.nucleo.catalogos import con_opciones, pais_de
from app.agendas_v2.nucleo.formulario import calificar
from app.agendas_v2.nucleo.tiempo import iso
from app.agendas_v2.nucleo.util import js_str, js_trim, js_truthy, txt

VERSION_CONTRATO = 1


def telefono_e164(pais, tel):
    """Número en formato internacional (+591…). Si el lead ya escribió el prefijo, se respeta."""
    crudo = js_trim(txt(tel))
    if not crudo:
        return ''
    dig = re.sub('[^0-9]', '', crudo)
    if crudo.startswith('+'):
        return '+' + dig
    pref = re.sub('[^0-9]', '', pais_de(pais)['d'])
    if crudo.startswith('00') and dig[2:].startswith(pref):
        return '+' + dig[2:]
    return '+' + pref + re.sub('^0+', '', dig)


def texto_respuesta(q, v, pais):
    if not js_truthy(v):
        return ''
    if con_opciones(q.get('tipo')):
        o = next((x for x in q['opciones'] if x['id'] == v), None)
        return o['texto'] if o else ''
    if q.get('tipo') == 'telefono':
        return pais_de(pais)['d'] + ' ' + js_str(v)
    if q.get('tipo') == 'instagram':
        return '@' + js_str(v)
    return v


def _de(asig, clave, clave_js):
    """Lee el resultado de asignacion() (claves snake_case; acepta también las del JS)."""
    return asig[clave] if clave in asig else asig.get(clave_js)


def armar_reserva(*, lead, evento, funnel=None, form=None, asig=None, slot=None, origen='', setter=None):
    """Arma el cuerpo de la reserva (y el de una agenda descalificada, con slot None).
    Guarda una copia de cada pregunta y respuesta para que la agenda se lea igual aunque después
    se edite el formulario.

    lead: {preguntas, resp, pais, tz}; evento: evento publicado; asig: resultado de asignacion();
    slot: {t, p} elegido o None; origen: slug de ?o= o ''."""
    preguntas, resp, pais, tz = lead['preguntas'], lead['resp'], lead.get('pais'), lead.get('tz')

    def val(k):
        return txt(resp.get('c-' + k))

    respuestas = []
    for q in preguntas:
        if q['id'].startswith('c-'):
            continue
        o = next((x for x in q['opciones'] if x['id'] == resp.get(q['id'])), None) if con_opciones(q['tipo']) else None
        respuestas.append(
            {
                'pregunta_id': q['id'],
                'pregunta': q['titulo'],
                'tipo': q['tipo'],
                'respuesta': texto_respuesta(q, resp.get(q['id']), pais),
                'opcion_id': o['id'] if o else None,
                'puntos': o['puntos'] if o else None,
                'peso': q['peso'],
                'descalifica': bool(o and o.get('descalifica')),
            }
        )
    return {
        'version': VERSION_CONTRATO,
        'evento_id': evento['id'],
        'evento_slug': evento['slug'],
        'funnel_id': funnel['id'] if funnel else '',
        'funnel_slug': funnel['slug'] if funnel else '',
        'funnel_tipo': funnel.get('tipo', 'otro') if funnel else '',
        'formulario_id': form['id'] if form else '',
        'inicio': iso(slot['t']) if slot else None,
        # La sesión del closer que tocó (lo suyo o la propuesta del evento) y su margen, como eran al agendar.
        'duracion_min': (slot or {}).get('dur') or evento['duracion'],
        'margen_min': (slot or {}).get('margen', evento.get('margen') or 0),
        'closer_id': slot['p'] if slot else None,
        'prioridad_id': asig['grupo']['id'] if asig and asig.get('grupo') else None,
        'prioridad_regla_id': (_de(asig, 'grupo_regla', 'grupoRegla') or None) if asig else None,
        'regla_idx': _de(asig, 'regla_idx', 'reglaIdx') if asig else None,
        'desborde': bool(asig and asig.get('desborde')),
        'nota': calificar(preguntas, resp),
        'descalificada': any(r['descalifica'] for r in respuestas),
        'origen': origen or '',
        'setter_id': setter or None,
        'lead': {
            'nombre': val('nombre'),
            'telefono': telefono_e164(pais, val('telefono')),
            'email': val('email').lower(),
            'instagram': val('instagram'),
            'pais': pais,
            'tz': tz,
        },
        'respuestas': respuestas,
    }
