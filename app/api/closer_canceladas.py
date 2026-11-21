"""Las agendas que el closer canceló en su Google Calendar y todavía no tienen motivo (ADR-W191): la tarjeta de su
mazo las pide y guarda la opción que elige (`cancelaciones_google`)."""
import logging

from flask import jsonify, request
from flask_login import current_user, login_required

from app import db
from app.api.closer import bp
from app.models import Appointment
from app.services import cancelaciones_google

logger = logging.getLogger(__name__)

# Quien puede ver la dirección: cualquier agenda. El resto, solo las suyas.
DIRECCION = ('admin', 'director_comercial')


@bp.route('/canceladas-google', methods=['GET'])
@login_required
def canceladas_google():
    """Las propias que esperan el motivo, y las opciones para elegir."""
    filas = cancelaciones_google.pendientes(current_user.id)
    return jsonify({'filas': filas, 'opciones': [{'key': k, 'label': v} for k, v in cancelaciones_google.OPCIONES.items()],
                    'reabren': sorted(cancelaciones_google.REABREN)}), 200


@bp.route('/canceladas-google/<int:agenda_id>', methods=['POST'])
@login_required
def motivo_cancelada_google(agenda_id):
    """`{opcion, detalle}`: guarda el motivo; con «otro closer», «reagendé por fuera» o «error», la reabre."""
    appt = db.session.get(Appointment, agenda_id)
    if not appt:
        return jsonify({'message': 'No existe esa agenda'}), 404
    if appt.closer_id != current_user.id and current_user.role not in DIRECCION:
        return jsonify({'message': 'Forbidden'}), 403
    datos = request.get_json(silent=True) or {}
    try:
        resultado = cancelaciones_google.registrar(appt, current_user, datos.get('opcion'), datos.get('detalle'))
        db.session.commit()
    except cancelaciones_google.MotivoGoogleInvalido as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 400
    except Exception as e:  # noqa: BLE001
        db.session.rollback()
        logger.error(f'[CANCELADA EN GOOGLE] No se pudo guardar el motivo de la agenda #{agenda_id}: {e}')
        return jsonify({'message': 'No se pudo guardar el motivo'}), 500
    return jsonify({'id': agenda_id, **resultado}), 200
