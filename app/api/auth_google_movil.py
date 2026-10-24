"""«Entrar con Google» para la app móvil. El flujo se explica en app/services/login_google.py (sección
"App móvil"): la app abre `inicio` en el navegador del teléfono, Google vuelve a /google/callback, que
devuelve a la app un código firmado, y la app lo canjea acá por el token."""
from flask import jsonify, redirect, request

from app.api import bp
from app.api.auth import _usuario_json
from app.services import login_google


@bp.route('/auth/google/movil/inicio', methods=['GET'])
def inicio_google_movil():
    """La app abre esta URL en el navegador (con `reto` = SHA-256 base64url de su verificador)."""
    reto = request.args.get('reto', '')
    if not login_google.reto_valido(reto):
        return jsonify({"message": "Reto inválido"}), 400
    return redirect(login_google.url_de_login(reto_movil=reto))


@bp.route('/auth/google/movil/canje', methods=['POST'])
def canje_google_movil():
    """Canjea el código que recibió la app por el token, igual que POST /auth/login."""
    data = request.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    codigo, verificador = data.get('code'), data.get('verifier')
    if not isinstance(codigo, str) or not isinstance(verificador, str) or not codigo or not verificador:
        return jsonify({"message": "Faltan datos"}), 400
    usuario = login_google.usuario_de_codigo_movil(codigo, verificador)
    if usuario is None:
        return jsonify({"message": "El código venció. Volvé a intentar"}), 401
    if not usuario.is_active:
        return jsonify({"message": "Tu cuenta está desactivada. Contacta a un administrador."}), 403
    return jsonify({"message": "Login successful", "token": usuario.get_auth_token(),
                    "user": _usuario_json(usuario)}), 200
