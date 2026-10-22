"""Las ventas de la persona en la ficha: listarlas, cancelarlas y reactivarlas (ver `ventas_service`)."""
from flask import jsonify, request
from flask_login import current_user

from app import db
from app.api.ficha import bp
from app.models import Sale
from app.services import ficha_lead_service, ventas_service

# Quién lee las ventas de una persona: los que cobran o corrigen (no setter ni triage).
ROLES_QUE_LEEN = ('admin', 'director_comercial', 'operator', 'closer')


def _no_lee():
    return current_user.role not in ROLES_QUE_LEEN


@bp.route('/ventas', methods=['GET'])
def ventas_de_persona():
    """`GET /api/ficha/ventas?person_uuid=<uuid>` o `?client_id=<id>`: sus ventas con pagos y saldo."""
    if _no_lee():
        return jsonify({'message': 'Forbidden'}), 403
    person_uuid = (request.args.get('person_uuid') or '').strip() or None
    client_id = request.args.get('client_id', type=int)
    if client_id and not person_uuid:
        from app.models import Client
        cliente = db.session.get(Client, client_id)
        person_uuid = cliente.person_uuid if cliente else None
    if not (person_uuid or client_id):
        return jsonify({'message': 'Falta person_uuid o client_id'}), 400
    return jsonify({'ventas': ventas_service.de_persona(person_uuid, client_id, current_user)}), 200


@bp.route('/<int:appt_id>/ventas', methods=['GET'])
def ventas_del_lead(appt_id):
    """Las ventas de la persona de la agenda, para la pestaña Fulfillment."""
    if _no_lee():
        return jsonify({'message': 'Forbidden'}), 403
    appt, client = ficha_lead_service.resolver_lead(appointment_id=appt_id)
    if not appt:
        return jsonify({'message': 'Lead no encontrado'}), 404
    person_uuid = (client.person_uuid if client else None) or appt.person_uuid
    return jsonify({'ventas': ventas_service.de_persona(person_uuid, getattr(client, 'id', None), current_user)}), 200


def _cambiar(sale_id, hacer):
    sale = db.session.get(Sale, sale_id)
    if sale is None:
        return jsonify({'message': 'Venta no encontrada'}), 404
    if not ventas_service.puede_gestionar(current_user, sale):
        return jsonify({'message': 'Solo el closer de la venta, Operaciones o un admin pueden cambiarla.'}), 403
    try:
        hacer(sale)
    except ValueError as e:
        return jsonify({'message': str(e)}), 422
    db.session.commit()
    return jsonify({'venta': ventas_service.a_dict(sale, current_user)}), 200


@bp.route('/ventas/<int:sale_id>/cancelar', methods=['POST'])
def cancelar_venta(sale_id):
    """`{motivo}` obligatorio. No toca los pagos ni la suscripción."""
    motivo = (request.get_json(silent=True) or {}).get('motivo')
    return _cambiar(sale_id, lambda s: ventas_service.cancelar(s, motivo, current_user))


@bp.route('/ventas/<int:sale_id>/reactivar', methods=['POST'])
def reactivar_venta(sale_id):
    return _cambiar(sale_id, lambda s: ventas_service.reactivar(s, current_user))


@bp.route('/ventas/revisar', methods=['GET'])
def ventas_para_revisar():
    """`?motivo=<texto>`: las ventas activas con motivo de revisión (Operaciones y admin)."""
    if current_user.role not in ventas_service.ROLES_QUE_GESTIONAN:
        return jsonify({'message': 'Forbidden'}), 403
    return jsonify(ventas_service.para_revisar((request.args.get('motivo') or '').strip() or None)), 200
