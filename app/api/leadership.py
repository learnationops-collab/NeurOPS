"""Entrar a Leadership con la sesion de Work.

`GET /api/leadership/entrar` devuelve una URL de Leadership con un pase firmado (HMAC-SHA256 con
`LEADERSHIP_HANDOFF_SECRET`, el mismo secreto que Leadership tiene como `HANDOFF_SECRET_WORK`).
El pase dura 60 segundos y Leadership lo acepta una sola vez; si el email no existe alla, crea la
cuenta. Todas las cuentas de Work pueden entrar, pero no simulando: el pase seria de la persona
simulada.

Devuelve la URL en vez de redirigir porque el SPA se autentica a veces solo con el Bearer de la
pestaña, que una navegacion del navegador no lleva. Sin el secreto responde 503 (falla cerrada).
"""
import base64
import hashlib
import hmac
import json
import os
import time
import uuid

from flask import jsonify
from flask_login import current_user, login_required

from app.api import bp

LEADERSHIP_URL_POR_DEFECTO = 'https://leadership.thelearnation.com'


def _b64(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).rstrip(b'=').decode()


def url_de_entrada(email: str, nombre: str, secreto: str, base: str) -> str:
    cuerpo = _b64(json.dumps({
        'iss': 'work',
        'email': email,
        'name': nombre,
        'exp': int(time.time()) + 60,
        'jti': str(uuid.uuid4()),
    }).encode())
    firma = _b64(hmac.new(secreto.encode(), cuerpo.encode(), hashlib.sha256).digest())
    return f"{base.rstrip('/')}/auth/handoff?token={cuerpo}.{firma}"


@bp.route('/leadership/entrar', methods=['GET'])
@login_required
def entrar_a_leadership():
    from app.models import get_impersonation_state

    secreto = os.environ.get('LEADERSHIP_HANDOFF_SECRET')
    if not secreto:
        return jsonify({"message": "Leadership no está configurado"}), 503
    if get_impersonation_state()[0]:
        return jsonify({"message": "Dejá de simular para entrar a Leadership"}), 403
    if not current_user.email:
        return jsonify({"message": "Tu cuenta no tiene email"}), 400

    base = os.environ.get('LEADERSHIP_URL', LEADERSHIP_URL_POR_DEFECTO)
    return jsonify({"url": url_de_entrada(current_user.email, current_user.username, secreto, base)}), 200
