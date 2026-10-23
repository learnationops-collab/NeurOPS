"""Corregir a mano la calificación de los leads de ManyChat (Marketing › Entrantes, 16/10/2026).

Del 28/07 al 16/10/2026 el webhook de la respuesta a la apertura mandaba «yes» fijo (no la variable
«Cualificado»): casi todos quedaron calificados. Lo real está en el campo «Cualificado» de ManyChat; esto
permite pasarlo al sistema de a una persona (la ficha de Entrantes) o en lote (una lista pegada).

La calificación de una persona es la última true/false de sus webhooks (ver `anuncios_service`): corregirla
es escribirla en su último webhook. «Sin dato» borra todas.
"""
from flask import jsonify, request

from app import db
from app.api.manychat import bp
from app.models import LeadAnswer, ManychatLead

ESTADOS = {'calificado': 'true', 'descalificado': 'false', 'sin_dato': 'null'}
# Lo que se acepta en el lote: lo que manda ManyChat (yes/no, 1/0) y los nombres de la pantalla.
VALORES = {
    'yes': 'true', 'si': 'true', 'sí': 'true', '1': 'true', 'true': 'true', 'calificado': 'true',
    'no': 'false', '0': 'false', 'false': 'false', 'descalificado': 'false',
    'sin dato': 'null', 'sin_dato': 'null', '': 'null',
}
MAXIMO_LOTE = 5000


def calificar(lead_id, valor):
    """Deja a la persona con esa calificación ('true' | 'false' | 'null'). Devuelve si cambió algo."""
    respuestas = LeadAnswer.query.filter_by(lead_id=lead_id).order_by(LeadAnswer.created_at.desc(), LeadAnswer.id.desc()).all()
    if not respuestas:
        return False
    if valor == 'null':
        cambio = any(r.qualification in ('true', 'false') for r in respuestas)
        for r in respuestas:
            r.qualification, r.calificacion_por_rama = 'null', False
        return cambio
    actual = next((r.qualification for r in respuestas if r.qualification in ('true', 'false')), None)
    # Lo elegido a mano ya no es deducido de la rama del mensaje (`rama_mensajes`).
    respuestas[0].qualification, respuestas[0].calificacion_por_rama = valor, False
    return actual != valor


def _clave_de(texto):
    """Un manychat_id o un Instagram («@ana.gomez», «ana.gomez»), normalizado."""
    return (texto or '').strip().lstrip('@').lower()


@bp.route('/manychat-webhook/lead/<int:lead_id>/calificacion', methods=['PUT'])
def corregir_calificacion(lead_id):
    estado = (request.get_json(silent=True) or {}).get('estado')
    if estado not in ESTADOS:
        return jsonify({'error': 'estado debe ser calificado, descalificado o sin_dato'}), 400
    if not ManychatLead.query.get(lead_id):
        return jsonify({'error': 'No existe ese lead'}), 404
    cambio = calificar(lead_id, ESTADOS[estado])
    db.session.commit()
    return jsonify({'lead_id': lead_id, 'estado': estado, 'cambio': cambio}), 200


@bp.route('/manychat-webhook/calificaciones', methods=['POST'])
def cargar_calificaciones():
    """Lote: `filas` = [{quien: manychat_id o @ig, calificacion: yes/no/1/0/…}]. Con `aplicar` en false
    solo cuenta qué pasaría (vista previa)."""
    datos = request.get_json(silent=True) or {}
    filas = datos.get('filas')
    if not isinstance(filas, list) or not filas:
        return jsonify({'error': 'Mandá al menos una fila'}), 400
    if len(filas) > MAXIMO_LOTE:
        return jsonify({'error': f'Hasta {MAXIMO_LOTE} filas por vez'}), 400

    pedidos, invalidas = {}, []
    for fila in filas:
        quien = _clave_de(str((fila or {}).get('quien') or ''))
        valor = VALORES.get(str((fila or {}).get('calificacion') or '').strip().lower())
        if not quien or valor is None:
            invalidas.append(fila)
            continue
        pedidos[quien] = valor

    leads = {}
    claves = list(pedidos)
    for i in range(0, len(claves), 500):
        tanda = claves[i:i + 500]
        for lead in ManychatLead.query.filter(db.or_(
                ManychatLead.manychat_id.in_(tanda), db.func.lower(ManychatLead.ig).in_(tanda))):
            for clave in (lead.manychat_id, (lead.ig or '').lower()):
                if clave in pedidos:
                    leads.setdefault(clave, lead.id)
    # Lo que no se encontró por la fila puede ser un Instagram de una persona (Etapa 2c): su lead.
    # Va después del cruce por la fila para no cambiar qué lead se califica en los que ya cruzaban.
    from app.services.lead_contacto_service import lead_por_ig
    for clave in set(pedidos) - set(leads):
        lead = lead_por_ig(clave)
        if lead is not None:
            leads[clave] = lead.id

    aplicar = bool(datos.get('aplicar'))
    cuenta = {'calificado': 0, 'descalificado': 0, 'sin_dato': 0}
    cambios = 0
    nombre = {v: k for k, v in ESTADOS.items()}
    for clave, lead_id in leads.items():
        cuenta[nombre[pedidos[clave]]] += 1
        if aplicar and calificar(lead_id, pedidos[clave]):
            cambios += 1
    if aplicar:
        db.session.commit()
    return jsonify({
        'encontrados': len(leads),
        'no_encontrados': sorted(set(pedidos) - set(leads))[:200],
        'cantidad_no_encontrados': len(set(pedidos) - set(leads)),
        'invalidas': len(invalidas),
        'por_estado': cuenta,
        'aplicado': aplicar,
        'cambios': cambios,
    }), 200
