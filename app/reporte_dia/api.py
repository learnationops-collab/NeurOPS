"""Rutas del reporte único (`/api/reporte`, ADR-W203). Ver `docs/plan_reporte_unico.md`."""
import logging

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.api.errores import error_interno
from app.models import User
from app.reporte_dia import dia as dia_mod
from app.reporte_dia import historial as historial_mod
from app.reporte_dia.comun import parse_fecha, rol_de
from app.reporte_dia.detalle import armar_detalle
from app.reporte_dia.guardar import EntradaInvalida, guardar
from app.reporte_dia.resultado import ResultadoInvalido, cargar

logger = logging.getLogger(__name__)
bp = Blueprint('reporte_dia', __name__)

GESTION = ('admin', 'operator')
PERIODOS = ('7', 'mes', '30')


def _objetivo(body=None):
    """(usuario, rol, None) del reporte que se mira, o (None, None, respuesta de error).
    Admin y operador pueden mirar el de otro con `user_id`."""
    user_id = request.args.get('user_id') or (body or {}).get('user_id')
    user = current_user
    if user_id and current_user.role in GESTION:
        try:
            user = db.session.get(User, int(user_id))
        except (TypeError, ValueError):
            user = None
        if user is None:
            return None, None, (jsonify({'error': 'Usuario no encontrado.'}), 404)
    elif user_id and str(user_id) != str(current_user.id):
        return None, None, (jsonify({'error': 'Solo podés ver tu propio reporte.'}), 403)
    rol = rol_de(user)
    if not rol:
        return None, None, (jsonify({'error': 'El reporte es para closers, setters y triage.'}), 403)
    return user, rol, None


def _fecha(user, valor):
    dia, error = parse_fecha(valor, user)
    return dia, (jsonify({'error': error}), 400) if error else None


@bp.route('/dia', methods=['GET'])
@login_required
def get_dia():
    user, rol, error = _objetivo()
    if error:
        return error
    dia, error = _fecha(user, request.args.get('fecha'))
    if error:
        return error
    try:
        return jsonify(dia_mod.armar(user, dia, rol)), 200
    except Exception as e:
        db.session.rollback()
        return error_interno(e, 'Error al armar el reporte del día')


@bp.route('/dia', methods=['PUT'])
@login_required
def put_dia():
    body = request.get_json(silent=True) or {}
    user, rol, error = _objetivo(body)
    if error:
        return error
    dia, error = _fecha(user, body.get('fecha'))
    if error:
        return error
    try:
        calc = guardar(user, rol, dia, body, current_user)
        return jsonify(dia_mod.armar(user, dia, rol, calc)), 200
    except EntradaInvalida as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return error_interno(e, 'Error al guardar el reporte del día')


@bp.route('/agenda-resultado', methods=['POST'])
@login_required
def post_agenda_resultado():
    body = request.get_json(silent=True) or {}
    user, rol, error = _objetivo(body)
    if error:
        return error
    dia, error = _fecha(user, body.get('fecha'))
    if error:
        return error
    try:
        cargar(user, current_user, body.get('appointment_id'), body.get('resultado'), body.get('motivo'))
    except ResultadoInvalido as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'campo': e.campo, **e.extra}), e.status
    except Exception as e:
        db.session.rollback()
        return error_interno(e, 'Error al guardar el resultado')
    try:
        return jsonify(dia_mod.armar(user, dia, rol)), 200
    except Exception as e:
        db.session.rollback()
        return error_interno(e, 'Resultado guardado; error al rearmar el día')


@bp.route('/historial', methods=['GET'])
@login_required
def get_historial():
    user, rol, error = _objetivo()
    if error:
        return error
    periodo = request.args.get('periodo') or '7'
    if periodo not in PERIODOS:
        return jsonify({'error': "Período inválido: 7, mes o 30."}), 400
    try:
        return jsonify(historial_mod.armar(user, rol, periodo)), 200
    except Exception as e:
        db.session.rollback()
        return error_interno(e, 'Error al armar el historial')


@bp.route('/detalle', methods=['GET'])
@login_required
def get_detalle():
    user, rol, error = _objetivo()
    if error:
        return error
    dia, error = _fecha(user, request.args.get('fecha'))
    if error:
        return error
    clave = (request.args.get('clave') or '').strip()
    if not clave:
        return jsonify({'error': 'Falta la clave del número.'}), 400
    try:
        salida = armar_detalle(user, dia, rol, clave)
    except Exception as e:
        db.session.rollback()
        return error_interno(e, 'Error al armar el detalle')
    if salida is None:
        return jsonify({'error': 'Ese número no existe en el reporte del día.'}), 404
    return jsonify(salida), 200
