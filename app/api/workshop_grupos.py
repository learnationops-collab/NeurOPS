"""Tipo del taller y sus grupos de WhatsApp por conjunto de anuncios (ver `workshop_grupos_service`).

Mismo permiso que el resto del panel de Workshop. El modal «Grupos» guarda todo junto en un solo pedido:
dos filas que intercambian conjunto no se pueden guardar de a una sin chocar con los únicos.
"""
from flask import current_app, jsonify, request
from flask_login import current_user

from app import db
from app.api.errores import error_interno
from app.api.workshop import bp
from app.decorators import workshop_required
from app.models import WorkshopEvent
from app.services import leadership_rituales_service, workshop_grupos_service as servicio
from app.services.workshop_agenda_service import DatoInvalido


@bp.route('/events/<int:event_id>/grupos', methods=['GET'])
@workshop_required
def grupos_del_taller(event_id):
    return jsonify(servicio.detalle(WorkshopEvent.query.get_or_404(event_id))), 200


@bp.route('/events/<int:event_id>/grupos', methods=['PUT'])
@workshop_required
def guardar_grupos_del_taller(event_id):
    """Body: `tipo` ('frio' | 'caliente' | null), `general` (el link del grupo general) y `grupos`, la
    lista completa: `[{id?, nombre, whatsapp_url, conjunto_id?, conjunto_nombre?, codigo?}]`."""
    evento = WorkshopEvent.query.get_or_404(event_id)
    general_antes = evento.whatsapp_url
    try:
        servicio.guardar(evento, request.get_json(silent=True) or {}, current_user)
        db.session.commit()
    except DatoInvalido as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return error_interno(e, 'No se pudieron guardar los grupos')
    if general_antes != evento.whatsapp_url:
        # Las tareas del taller en Leadership llevan el link del grupo general.
        leadership_rituales_service.sincronizar_en_segundo_plano(current_app._get_current_object(), [evento.id])
    return jsonify(servicio.detalle(evento)), 200
