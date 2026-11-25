"""API de «Mi sueldo» (ADR-W223), la herramienta del dock de setters, closers y el director comercial.

Cada uno ve lo suyo. Quien dirige (director comercial, admin y operador) elige además a cualquiera de
la nómina comercial con `clave`; a los demás se les ignora y reciben lo suyo, como en el dashboard
comercial (`comercial.alcance_de`).
"""
import logging
import re

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app.models.user import ROLE_ADMIN, ROLE_CLOSER, ROLE_DIRECTOR_COMERCIAL, ROLE_OPERATOR, ROLE_SETTER
from app.services import mi_sueldo_service as servicio

logger = logging.getLogger(__name__)
bp = Blueprint('mi_sueldo_api', __name__)

ROLES_QUE_ELIGEN = (ROLE_DIRECTOR_COMERCIAL, ROLE_ADMIN, ROLE_OPERATOR)
ROLES_CON_ACCESO = ROLES_QUE_ELIGEN + (ROLE_CLOSER, ROLE_SETTER)
_MES = re.compile(r'^\d{4}-(0[1-9]|1[0-2])$')


@bp.route('', methods=['GET'])
@login_required
def mi_sueldo():
    if current_user.role not in ROLES_CON_ACCESO:
        return jsonify({'message': 'Forbidden'}), 403
    from app.services.user_time_service import hoy_del_usuario

    hoy = hoy_del_usuario(current_user)
    actual = hoy.strftime('%Y-%m')
    mes = request.args.get('mes') or actual
    if not _MES.match(mes) or mes > actual:
        return jsonify({'message': 'El mes va como AAAA-MM y no puede ser futuro'}), 400

    personas = servicio.personas()
    propia = servicio.clave_de_usuario(current_user)
    elige = current_user.role in ROLES_QUE_ELIGEN
    pedida = request.args.get('clave') if elige else None
    clave = pedida if pedida in {p['clave'] for p in personas} else propia
    if not clave and elige:
        clave = personas[0]['clave']
    if not clave:
        return jsonify({'message': 'No figurás en la nómina comercial: pedile a Finanzas que te sume'}), 404

    try:
        datos = servicio.composicion(clave, mes, hoy)
    except Exception as e:
        logger.error(f'mi_sueldo {clave} {mes}: {e}')
        return jsonify({'message': 'No se pudo calcular el sueldo'}), 500
    persona = next(p for p in personas if p['clave'] == clave)
    return jsonify({**datos, 'persona': {**persona, 'propia': clave == propia},
                    'personas': personas if elige else None, 'propia': propia}), 200
