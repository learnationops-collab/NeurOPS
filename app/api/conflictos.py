"""La vista Conflictos (ver `conflictos_service`): listar, ver la historia de un caso, cerrarlo o reabrirlo."""
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app.services import conflictos_service as conflictos

bp = Blueprint('conflictos', __name__)


def _responder(accion):
    try:
        return jsonify(accion()), 200
    except conflictos.ErrorConflicto as e:
        return jsonify({'message': str(e)}), e.codigo


@bp.route('/conflictos', methods=['GET'])
@login_required
def listar():
    return jsonify(conflictos.listar(current_user, request.args.get('estado') or 'abierto')), 200


@bp.route('/conflictos/cuenta', methods=['GET'])
@login_required
def cuenta():
    """Los abiertos que ve esta cuenta: el menú de sesión muestra «Conflictos» solo si hay alguno."""
    return jsonify({'abiertos': conflictos.cuenta(current_user)}), 200


@bp.route('/conflictos', methods=['POST'])
@login_required
def crear():
    if not conflictos.ve_todos(current_user):
        return jsonify({'message': 'Forbidden'}), 403
    return _responder(lambda: conflictos.crear(request.get_json(silent=True) or {}, current_user))


@bp.route('/conflictos/<int:conflicto_id>', methods=['GET'])
@login_required
def detalle(conflicto_id):
    return _responder(lambda: conflictos.detalle(conflictos.buscar(current_user, conflicto_id)))


@bp.route('/conflictos/<int:conflicto_id>/cerrar', methods=['POST'])
@login_required
def cerrar(conflicto_id):
    datos = request.get_json(silent=True) or {}
    return _responder(lambda: conflictos.cerrar(conflictos.buscar(current_user, conflicto_id), datos, current_user))


@bp.route('/conflictos/<int:conflicto_id>/reabrir', methods=['POST'])
@login_required
def reabrir(conflicto_id):
    return _responder(lambda: conflictos.reabrir(conflictos.buscar(current_user, conflicto_id), current_user))
