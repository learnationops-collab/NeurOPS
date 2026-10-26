"""La campanita: los avisos del usuario (docs/plan_notas_avisos_settings.md §2.2, etapa 3)."""
from flask import Blueprint, jsonify
from flask_login import current_user, login_required

from app import db
from app.models import Notification
from app.services import avisos_service

bp = Blueprint('avisos', __name__)
LIMITE = 50


@bp.route('', methods=['GET'], strict_slashes=False)
@login_required
def listar():
    avisos = avisos_service.de(current_user)
    sin_leer = sum(1 for a in avisos if not avisos_service.leido(a, current_user))
    return jsonify({'sin_leer': sin_leer,
                    'avisos': [avisos_service.a_dict(a, current_user) for a in avisos[:LIMITE]]})


@bp.route('/cuenta', methods=['GET'])
@login_required
def cuenta():
    return jsonify({'sin_leer': len(avisos_service.sin_leer(current_user))})


@bp.route('/<int:aviso_id>/leido', methods=['POST'])
@login_required
def leido(aviso_id):
    aviso = db.session.get(Notification, aviso_id)
    if aviso is None or not avisos_service._es_para(aviso, current_user):
        return jsonify({'error': 'Ese aviso no es tuyo.'}), 404
    avisos_service.marcar([aviso], current_user)
    return jsonify({'ok': True})


@bp.route('/leidos', methods=['POST'])
@login_required
def todos_leidos():
    avisos_service.marcar(avisos_service.sin_leer(current_user), current_user)
    return jsonify({'ok': True})
