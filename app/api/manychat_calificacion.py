"""Corregir a mano la calificación de los leads de ManyChat (Marketing › Entrantes, 16/10/2026).

Del 28/07 al 16/10/2026 el webhook de la respuesta a la apertura mandaba «yes» fijo (no la variable
«Cualificado»): casi todos quedaron calificados. Lo real está en el campo «Cualificado» de ManyChat; esto
permite pasarlo al sistema de a una persona (la ficha de Entrantes).

La calificación de una persona es la última true/false de sus webhooks (ver `anuncios_service`): corregirla
es escribirla en su último webhook. «Sin dato» borra todas.
"""
from flask import jsonify, request

from app import db
from app.api.manychat import bp
from app.models import LeadAnswer, Conversation

ESTADOS = {'calificado': 'true', 'descalificado': 'false', 'sin_dato': 'null'}


def calificar(lead_id, valor):
    """Deja a la persona con esa calificación ('true' | 'false' | 'null'). Devuelve si cambió algo."""
    respuestas = LeadAnswer.query.filter_by(conversation_id=lead_id).order_by(LeadAnswer.created_at.desc(), LeadAnswer.id.desc()).all()
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



@bp.route('/manychat-webhook/lead/<int:lead_id>/calificacion', methods=['PUT'])
def corregir_calificacion(lead_id):
    estado = (request.get_json(silent=True) or {}).get('estado')
    if estado not in ESTADOS:
        return jsonify({'error': 'estado debe ser calificado, descalificado o sin_dato'}), 400
    if not Conversation.query.get(lead_id):
        return jsonify({'error': 'No existe ese lead'}), 404
    cambio = calificar(lead_id, ESTADOS[estado])
    db.session.commit()
    return jsonify({'lead_id': lead_id, 'estado': estado, 'cambio': cambio}), 200

