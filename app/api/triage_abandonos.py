"""Los abandonos del formulario (leads que dejaron sus datos y no agendaron) para el triage, que los contacta primero."""
from flask import jsonify, request
from flask_login import current_user

from app.agendas_v2 import abandonos
from app.api.auth import login_required
from app.api.triage import bp
from app.decorators import triage_metricas_required


@bp.route('/abandonos', methods=['GET'])
@login_required
@triage_metricas_required
def listar_abandonos():
    """Los de las últimas 48 horas que siguen sin agendar."""
    return jsonify({'abandonos': abandonos.pendientes(), 'horas': abandonos.HORAS_LISTA}), 200


@bp.route('/abandonos/<int:intento_id>/contacto', methods=['POST'])
@login_required
@triage_metricas_required
def marcar_abandono(intento_id):
    """`estado`: 'contactado', 'no_contesta' o null (lo deja sin tocar)."""
    estado = (request.get_json(silent=True) or {}).get('estado')
    if estado is not None and estado not in abandonos.CONTACTOS:
        return jsonify({'message': 'Estado inválido.'}), 400
    if abandonos.marcar_contacto(intento_id, estado, current_user) is None:
        return jsonify({'message': 'Ese lead ya agendó o no existe.'}), 404
    return jsonify({'ok': True}), 200
