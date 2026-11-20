"""Leadership rápido desde Work: el puente a `/api/v1/rapido` de Leadership (su RapidoController).

El frontend (ventana «Leadership», ventanas/herramientas/leadership/) le pide a Work y Work le pasa el
pedido a Leadership con un pase firmado por pedido: el mismo del ingreso (`api/leadership.py`, secreto
`LEADERSHIP_HANDOFF_SECRET` = `HANDOFF_SECRET_WORK` de Leadership), con el email de la sesión, 60 s y un
jti de un solo uso. Sin tokens compartidos; Leadership anota cada cambio en `api_acciones`.

Solo pasa lo que la API ofrece (lista fija de rutas) y no se usa simulando: el pase sería del simulado.
"""
import json
import logging
import os
import re
import time
import uuid
import hmac
import hashlib

import requests
from flask import jsonify, request
from flask_login import current_user, login_required

from app.api import bp
from app.api.leadership import LEADERSHIP_URL_POR_DEFECTO, _b64

logger = logging.getLogger(__name__)

TIMEOUT = 20

# Lo que se puede pedir: (método, ruta relativa a /api/v1/rapido).
PERMITIDAS = [
    ('GET', r''),
    ('GET', r'/opciones'),
    ('POST', r'/crear'),
    ('PATCH', r'/(inbox|task|project)/\d+'),
    ('POST', r'/(task|project|habit)/\d+/completar'),
    ('POST', r'/(task|habit)/\d+/reabrir'),
    ('POST', r'/task/\d+/entregar'),
    ('POST', r'/(task|project)/\d+/pedir-update'),
]


def pase(email: str, secreto: str) -> str:
    cuerpo = _b64(json.dumps({
        'iss': 'work',
        'email': email,
        'exp': int(time.time()) + 60,
        'jti': str(uuid.uuid4()),
        'aud': 'rapido',
    }).encode())
    firma = _b64(hmac.new(secreto.encode(), cuerpo.encode(), hashlib.sha256).digest())
    return f'{cuerpo}.{firma}'


def _permitida(metodo: str, ruta: str) -> bool:
    return any(metodo == m and re.fullmatch(patron, ruta) for m, patron in PERMITIDAS)


@bp.route('/leadership/rapido', defaults={'ruta': ''}, methods=['GET', 'POST', 'PATCH'])
@bp.route('/leadership/rapido/<path:ruta>', methods=['GET', 'POST', 'PATCH'])
@login_required
def leadership_rapido(ruta):
    from app.models import get_impersonation_state

    ruta = f'/{ruta}' if ruta else ''
    if not _permitida(request.method, ruta):
        return jsonify({'error': 'no_esta', 'mensaje': 'Eso no se puede hacer desde Work.'}), 404

    secreto = os.environ.get('LEADERSHIP_HANDOFF_SECRET')
    if not secreto:
        return jsonify({'error': 'sin_configurar', 'mensaje': 'Leadership no está configurado.'}), 503
    if get_impersonation_state()[0]:
        return jsonify({'error': 'simulando', 'mensaje': 'Simulando no se puede usar Leadership.'}), 403
    if not current_user.email:
        return jsonify({'error': 'sin_email', 'mensaje': 'Tu cuenta no tiene email.'}), 400

    base = os.environ.get('LEADERSHIP_URL', LEADERSHIP_URL_POR_DEFECTO).rstrip('/')
    try:
        r = requests.request(
            request.method, f'{base}/api/v1/rapido{ruta}',
            headers={'Authorization': f'Pase {pase(current_user.email, secreto)}', 'Accept': 'application/json'},
            json=request.get_json(silent=True) if request.method != 'GET' else None,
            timeout=TIMEOUT,
        )
    except requests.RequestException as e:
        logger.error(f'leadership rapido {request.method} {ruta}: {e}')
        return jsonify({'error': 'sin_respuesta', 'mensaje': 'Leadership no responde. Probá en un rato.'}), 502

    try:
        datos = r.json()
    except ValueError:
        logger.error(f'leadership rapido {request.method} {ruta}: {r.status_code} {r.text[:200]}')
        return jsonify({'error': 'respuesta', 'mensaje': 'Leadership respondió algo inesperado.'}), 502
    return jsonify(datos), r.status_code
