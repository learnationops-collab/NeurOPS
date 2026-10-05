"""API de gestion de Agendas 2.0 (/api/agendas-v2): la usa Thalamus, la herramienta del director
comercial. Toda ruta exige sesion y rol de direccion; la guarda vive en el before_request, asi que
ninguna vista puede olvidarse de chequearlo. Contrato: docs/agendas_v2_api.md.
"""

import re

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app.agendas_v2 import servicio
from app.agendas_v2.nucleo.normalizar import COLECCIONES
from app.models.user import ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL

bp = Blueprint('agendas_v2_admin', __name__)

ROLES_CON_ACCESO = (ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL)
ID_VALIDO = re.compile(r'^[A-Za-z0-9_-]{1,40}$')


@bp.before_request
@login_required
def _solo_direccion():
    if current_user.role not in ROLES_CON_ACCESO:
        return jsonify({'message': 'Forbidden'}), 403


def _validar(col, doc_id):
    if col not in COLECCIONES or not ID_VALIDO.match(doc_id or ''):
        return jsonify({'message': 'Not found'}), 404
    return None


def _cuerpo():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else {}


@bp.route('/estado', methods=['GET'])
def estado():
    """Todo lo que Thalamus necesita al abrir: colecciones, perfil propio, integraciones y reservas."""
    return jsonify(
        {
            'cols': servicio.colecciones(),
            'perfil': servicio.perfil_de(current_user.id),
            'integ': servicio.integraciones(),
            'reservas': servicio.reservas_para_estado(),
            'version': servicio.version(),
        }
    )


@bp.route('/version', methods=['GET'])
def version():
    return jsonify({'version': servicio.version()})


@bp.route('/<col>/<doc_id>', methods=['PUT'])
def reemplazar(col, doc_id):
    error = _validar(col, doc_id)
    if error:
        return error
    doc = servicio.guardar_doc(col, doc_id, _cuerpo(), usuario_id=current_user.id)
    return jsonify({'doc': doc, 'version': servicio.version()})


@bp.route('/<col>/<doc_id>', methods=['PATCH'])
def actualizar(col, doc_id):
    error = _validar(col, doc_id)
    if error:
        return error
    doc = servicio.guardar_doc(col, doc_id, _cuerpo(), usuario_id=current_user.id, parcial=True)
    if doc is None:
        return jsonify({'message': 'Not found'}), 404
    return jsonify({'doc': doc, 'version': servicio.version()})


@bp.route('/<col>/<doc_id>', methods=['DELETE'])
def borrar(col, doc_id):
    error = _validar(col, doc_id)
    if error:
        return error
    servicio.borrar_doc(col, doc_id)  # borrar algo que ya no esta no es un error
    return jsonify({'ok': True, 'version': servicio.version()})


@bp.route('/perfil', methods=['PUT'])
def perfil():
    return jsonify({'perfil': servicio.guardar_perfil(current_user.id, _cuerpo())})


@bp.route('/integraciones', methods=['PUT'])
def integraciones():
    integ = servicio.guardar_integraciones(_cuerpo())
    return jsonify({'integ': integ, 'version': servicio.version()})


@bp.route('/reservas/<reserva_id>/cancelar', methods=['POST'])
def cancelar(reserva_id):
    if not ID_VALIDO.match(reserva_id or ''):
        return jsonify({'message': 'Not found'}), 404
    r = servicio.cancelar_reserva(reserva_id)
    if not r:
        return jsonify({'message': 'Not found'}), 404
    return jsonify({'reserva': r, 'version': servicio.version()})
