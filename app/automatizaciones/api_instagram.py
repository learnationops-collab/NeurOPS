"""«Conectar Instagram» del Inbox (ADR-W286): el estado del token y el login con Instagram.

Solo admin, operador y dirección comercial: conectar reemplaza el token con el que escribe todo el Inbox.
La vuelta de Instagram llega sin el token de Work (es una redirección del navegador): va por `bp_publico` y
quién la pidió viaja firmado en `state` (15 minutos).
"""
import os

from flask import current_app, jsonify, redirect, request
from flask_login import current_user
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.automatizaciones import servicio, token_ig
from app.automatizaciones.api import ROLES_CON_ACCESO, bp
from app.automatizaciones.api_escribir import bp_publico

SAL = 'inbox-conectar-instagram'
VALE = 15 * 60


def _firma():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SAL)


def _redirect_uri():
    fija = (os.environ.get('IG_REDIRECT_URI') or '').strip()
    if fija:
        return fija
    raiz = request.url_root.rstrip('/')
    # Detrás del proxy de Railway llega como http: Meta exige la URL exacta y con https.
    if raiz.startswith('http://') and 'localhost' not in raiz and '127.0.0.1' not in raiz:
        raiz = 'https://' + raiz[len('http://'):]
    return raiz + '/api/inbox-publico/instagram/vuelta'


@bp.route('/instagram/conexion', methods=['GET'])
def conexion_instagram():
    if current_user.role not in ROLES_CON_ACCESO:
        return jsonify({'message': 'Forbidden'}), 403
    return jsonify({**token_ig.estado(), 'redirect_uri': _redirect_uri()})


@bp.route('/instagram/conectar', methods=['GET'])
def conectar_instagram():
    """La URL del login con Instagram; el navegador va ahí y vuelve a `/instagram/vuelta`."""
    if current_user.role not in ROLES_CON_ACCESO:
        return jsonify({'message': 'Forbidden'}), 403
    try:
        url = token_ig.url_de_conexion(_redirect_uri(), _firma().dumps({'u': current_user.id}))
    except token_ig.ErrorDeConexion as e:
        return jsonify({'message': str(e)}), 409
    return jsonify({'url': url})


@bp_publico.route('/instagram/vuelta', methods=['GET'])
def vuelta_de_instagram():
    from app import db
    from app.models import User
    destino = '/inbox?instagram='
    if request.args.get('error'):
        return redirect(destino + 'cancelado')
    try:
        datos = _firma().loads(request.args.get('state') or '', max_age=VALE)
    except BadSignature:
        return redirect(destino + 'vencido')
    quien = db.session.get(User, datos.get('u'))
    if quien is None or quien.role not in ROLES_CON_ACCESO or not request.args.get('code'):
        return redirect(destino + 'error')
    try:
        token_ig.conectar(request.args['code'], _redirect_uri(), servicio.ahora())
    except Exception as e:  # noqa: BLE001  (lo que diga Meta, en el log; la persona vuelve al Inbox con el aviso)
        db.session.rollback()
        current_app.logger.error(f'[IG TOKEN] No se pudo conectar: {e}')
        return redirect(destino + 'error')
    current_app.logger.info(f'[IG TOKEN] Instagram conectado por {quien.username}')
    return redirect(destino + 'conectado')
