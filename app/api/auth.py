import re

from flask import request, jsonify
from flask_login import login_user, logout_user, current_user, login_required
import sqlalchemy as sa
from app import db
from app.api import bp
from app.decorators import operator_required
from app.models import User
from app.services.cuentas_vinculadas import (
    VinculoInvalido, cuentas_de, desvincular, listar_personas, puede_cambiar_a, vincular,
)

def _usuario_json(u, **extra):
    """El usuario como lo ve el frontend. `role` es el rol ACTIVO; `roles` son todos los que tiene."""
    return {
        "id": u.id,
        "username": u.username,
        "role": u.role,
        "roles": u.roles,
        "email": u.email,
        "can_view_finance": getattr(u, 'can_view_finance', False),
        "cuentas_vinculadas": cuentas_de(u),
        "mascota": u.mascota,
        **extra,
    }


@bp.route('/auth/login', methods=['POST'])
def login():
    """
    Standard Login Endpoint. 
    Prioritizes JWT Token generation.
    """
    data = request.get_json() or {}
    if not isinstance(data, dict):  # un JSON valido pero que no es un objeto (lista, numero, texto)
        data = {}
    username = data.get('username')
    password = data.get('password')

    # Solo texto: un numero, lista u objeto rompia la consulta o el hash y contestaba 500 a quien quisiera.
    if not isinstance(username, str) or not isinstance(password, str) or not username or not password:
        return jsonify({"message": "Username and password required"}), 400

    # 1. Find User
    user = db.session.scalar(sa.select(User).where(User.username == username))
    
    # 2. Try Email if username failed
    if not user:
        user = db.session.scalar(sa.select(User).where(User.email == username))

    # 3. Validate
    if user is None or not user.check_password(password):
        return jsonify({"message": "Invalid credentials"}), 401

    # Cuenta desactivada: se avisa DESPUES de acertar la clave, para no revelar que un usuario existe.
    # login_user() rechaza a un usuario inactivo pero devuelve False, y antes se ignoraba ese
    # resultado y se entregaba igual un JWT de 24 h que luego daba 401 en todas partes.
    if not user.is_active:
        return jsonify({"message": "Tu cuenta está desactivada. Contacta a un administrador."}), 403

    # 4. Login Session (Optional / Legacy support)
    login_user(user, remember=True)
    from flask import session
    session.pop('active_role', None)  # se entra siempre con el rol principal

    # Sincronizar la timezone del usuario con la detectada por su navegador en cada login,
    # para que los cálculos de "día calendario" en el backend (dashboard, mazo del closer, etc.)
    # siempre reflejen su zona horaria real en vez de un valor manual desactualizado.
    tz_from_browser = data.get('timezone')
    if tz_from_browser and tz_from_browser != user.timezone:
        import pytz
        try:
            pytz.timezone(tz_from_browser)
            user.timezone = tz_from_browser
            db.session.commit()
        except Exception:
            pass

    # 5. Generate Token (Primary Auth Method)
    token = user.get_auth_token()

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "roles": user.roles,
            "email": user.email,
            "can_view_finance": getattr(user, 'can_view_finance', False),
            "cuentas_vinculadas": cuentas_de(user),
            "mascota": user.mascota,
        }
    }), 200

@bp.route('/auth/google', methods=['GET'])
def login_con_google():
    """Arranca «Entrar con Google»: devuelve la URL de Google. Ver app/services/login_google.py."""
    from app.services.login_google import url_de_login
    return jsonify({"auth_url": url_de_login()}), 200


@bp.route('/auth/google/sesion', methods=['POST'])
def sesion_de_google():
    """Después de entrar con Google (que deja la sesión de cookie), la pantalla de login canjea esa
    sesión por el token, igual que POST /auth/login. Solo una vez y solo si la sesión viene de Google."""
    from flask import session
    usuario_id = session.pop('google_login', None)
    if not current_user.is_authenticated or usuario_id != current_user.id:
        return jsonify({"message": "No hay un inicio de sesión con Google pendiente"}), 401
    return jsonify({"message": "Login successful", "token": current_user.get_auth_token(),
                    "user": _usuario_json(current_user)}), 200


EMAIL_VALIDO = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


@bp.route('/auth/me/email', methods=['PUT'])
@login_required
def cargar_mi_email():
    """El usuario sin email lo carga (se le pide al entrar), para poder entrar con Google la próxima.
    Solo si no tenía: cambiar un email existente lo hace un admin (Team y Agendas 2.0 lo usan)."""
    from app.models import get_impersonation_state
    if get_impersonation_state()[0]:
        return jsonify({"message": "No se puede cargar el email mientras simulás a otro usuario"}), 403
    if current_user.email:
        return jsonify({"message": "Ya tenés un email cargado. Para cambiarlo, pedíselo a un administrador."}), 409
    email = ((request.get_json(silent=True) or {}).get('email') or '')
    email = email.strip().lower() if isinstance(email, str) else ''
    if not EMAIL_VALIDO.match(email) or len(email) > 120:
        return jsonify({"message": "Ese email no es válido"}), 400
    if db.session.scalar(sa.select(User.id).where(sa.func.lower(User.email) == email)):
        return jsonify({"message": "Ese email ya lo usa otra cuenta"}), 409
    current_user.email = email
    db.session.commit()
    return jsonify({"user": _usuario_json(current_user)}), 200


@bp.route('/auth/me/mascota', methods=['PUT'])
@login_required
def elegir_mi_mascota():
    """El personaje del avatar (menú de sesión del dock). PUT {mascota}: uno de `MASCOTAS`.
    Simulando no: sería cambiarle el avatar a la persona simulada."""
    from app.models import get_impersonation_state
    from app.models.user import MASCOTAS
    if get_impersonation_state()[0]:
        return jsonify({"message": "No se puede cambiar el personaje mientras simulás a otro usuario"}), 403
    mascota = (request.get_json(silent=True) or {}).get('mascota')
    if mascota not in MASCOTAS:
        return jsonify({"message": "Ese personaje no existe"}), 400
    current_user.mascota = mascota
    db.session.commit()
    return jsonify({"mascota": mascota}), 200


def _whatsapp_json(u):
    return {"numero": u.two_chat_number or '', "confirmado": bool(u.whatsapp_confirmado_en and u.two_chat_number)}


@bp.route('/auth/me/whatsapp', methods=['GET', 'PUT'])
@login_required
def mi_whatsapp():
    """El WhatsApp donde el closer recibe el aviso de cada agenda nueva (y los recordatorios de
    seguimiento). Cambiarlo obliga a confirmarlo de nuevo con un mensaje de prueba."""
    if request.method == 'PUT':
        from app.services.whatchimp_service import WhatchimpService
        numero = WhatchimpService.normalize_phone((request.get_json(silent=True) or {}).get('numero'))
        if not 8 <= len(numero) <= 15:
            return jsonify({"message": "Escribí el número con código de país, sin + ni espacios (ej.: 5491122334455)"}), 400
        if numero != (current_user.two_chat_number or ''):
            current_user.two_chat_number = numero
            current_user.whatsapp_confirmado_en = None
            db.session.commit()
    return jsonify(_whatsapp_json(current_user)), 200


@bp.route('/auth/me/whatsapp/prueba', methods=['POST'])
@login_required
def mi_whatsapp_prueba():
    """Manda el WhatsApp de prueba (la misma plantilla del aviso de agenda) al número cargado."""
    from flask import current_app, session
    from app.services.whatchimp_service import AvisoDeAgenda
    if not current_user.two_chat_number:
        return jsonify({"message": "Primero guardá tu número"}), 400
    try:
        AvisoDeAgenda.prueba(current_user.two_chat_number, current_user.username)
    except Exception as e:  # noqa: BLE001  (Whatchimp, red o la clave: se le dice al closer)
        current_app.logger.warning(f'[WHATSAPP] Falló la prueba al usuario #{current_user.id}: {e}')
        return jsonify({"message": "No se pudo mandar el mensaje. Revisá el número o avisá a operaciones."}), 502
    session['whatsapp_prueba'] = current_user.two_chat_number
    return jsonify({"message": "Mensaje enviado"}), 200


@bp.route('/auth/me/whatsapp/confirmar', methods=['POST'])
@login_required
def mi_whatsapp_confirmar():
    """«Me llegó»: solo después de mandar la prueba a ESE número en esta sesión."""
    from flask import session
    if not current_user.two_chat_number or session.get('whatsapp_prueba') != current_user.two_chat_number:
        return jsonify({"message": "Primero mandate el mensaje de prueba"}), 400
    from datetime import datetime
    current_user.whatsapp_confirmado_en = datetime.utcnow()
    db.session.commit()
    session.pop('whatsapp_prueba', None)
    return jsonify(_whatsapp_json(current_user)), 200


@bp.route('/auth/me/disponibilidad', methods=['GET', 'PUT'])
@login_required
def mi_disponibilidad():
    """El horario semanal del closer y su zona horaria. Es el de su persona de Team en Agendamiento:
    lo edita él acá o la dirección comercial allá. PUT {horario, tz}."""
    from app.agendas_v2 import servicio
    if not current_user.tiene_rol('closer'):
        return jsonify({"message": "Solo los closers tienen disponibilidad"}), 403
    if request.method == 'PUT':
        datos = request.get_json(silent=True) or {}
        try:
            return jsonify(servicio.guardar_disponibilidad(current_user, datos.get('horario'), datos.get('tz'))), 200
        except ValueError as e:
            return jsonify({"message": str(e)}), 400
    return jsonify(servicio.disponibilidad_de(current_user)), 200


@bp.route('/auth/me/foto', methods=['GET', 'PUT'])
@login_required
def mi_foto():
    """La foto de la cuenta (la ve el lead en su consultor y el equipo en Team). PUT {foto}: data URL
    JPG/PNG/WEBP chica, o '' para sacarla."""
    from app.agendas_v2 import servicio
    if request.method == 'PUT':
        datos = request.get_json(silent=True) or {}
        try:
            return jsonify({'foto': servicio.guardar_foto(current_user, datos.get('foto') or '')}), 200
        except ValueError as e:
            return jsonify({"message": str(e)}), 400
    return jsonify({'foto': servicio.foto_de(current_user)}), 200


@bp.route('/auth/me/eventos', methods=['GET'])
@login_required
def mis_eventos():
    """Los eventos propios del closer en Agendamiento (link directo con él) y los formularios que puede usar."""
    from app.agendas_v2 import servicio
    if not current_user.tiene_rol('closer'):
        return jsonify({"message": "Solo los closers tienen eventos propios"}), 403
    return jsonify(servicio.eventos_de_closer(current_user)), 200


@bp.route('/auth/me/eventos/<evento_id>', methods=['PUT', 'DELETE'])
@login_required
def mi_evento(evento_id):
    """Crea, edita (y publica) o borra un evento propio. Nunca toca los de otros. PUT {nombre, duracion,
    formulario ('' = solo datos de contacto), activo, desc, redir, indic, reservas, antel, paso, zona}."""
    import re
    from app.agendas_v2 import servicio
    if not current_user.tiene_rol('closer'):
        return jsonify({"message": "Solo los closers tienen eventos propios"}), 403
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,40}', evento_id or ''):
        return jsonify({"message": "Not found"}), 404
    try:
        if request.method == 'DELETE':
            servicio.borrar_evento_de_closer(current_user, evento_id)
            return jsonify({'ok': True}), 200
        datos = request.get_json(silent=True)
        evento = servicio.guardar_evento_de_closer(current_user, evento_id, datos if isinstance(datos, dict) else {})
        return jsonify({'evento': evento}), 200
    except PermissionError as e:
        return jsonify({"message": str(e)}), 403
    except ValueError as e:
        return jsonify({"message": str(e)}), 400


@bp.route('/admin/users/<int:user_id>/reset-password', methods=['POST'])
@login_required
@operator_required
def resetear_contrasena(user_id):
    """Admin u operador: le pone a la cuenta una contraseña temporal nueva y la devuelve una sola vez,
    para pasársela a la persona. La vieja deja de servir."""
    import secrets
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "Not found"}), 404
    temporal = secrets.token_urlsafe(9)
    user.set_password(temporal)
    db.session.commit()
    return jsonify({"password": temporal, "username": user.username}), 200


@bp.route('/auth/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({"message": "Logout successful"}), 200

@bp.route('/auth/me', methods=['GET'])
def get_me():
    if not current_user.is_authenticated:
        return jsonify({"message": "Not authenticated"}), 401

    from app.models import get_impersonation_state
    is_impersonating, _, original_user_role = get_impersonation_state()

    return jsonify({
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "role": current_user.role,
            "roles": [] if is_impersonating else current_user.roles,
            "email": current_user.email,
            "is_impersonating": is_impersonating,
            "original_user_role": original_user_role,
            "can_view_finance": getattr(current_user, 'can_view_finance', False),
            "cuentas_vinculadas": [] if is_impersonating else cuentas_de(current_user),
            "mascota": current_user.mascota,
        }
    }), 200

def _quien_simula():
    """El usuario REAL detrás de la sesión: el original si ya está simulando, si no el logueado.

    Lo que puede simular se decide por él y no por el usuario simulado. Antes, quien ya estaba
    simulando podía saltar a cualquiera "para cambiar de usuario sin volver"; con solo admin y
    operator simulando daba igual, pero el director comercial simula closers, y un closer simulado
    no puede ser la puerta a un admin. El original se relee de la base (no del token ni de la
    cookie): si mientras simula lo desactivan o le cambian el rol, ya no simula a nadie más.
    """
    from app.models import get_impersonation_state
    is_impersonating, original_id, _ = get_impersonation_state()
    if not is_impersonating:
        return current_user
    original = db.session.get(User, original_id) if original_id else None
    return original if original is not None and original.is_active else None


def _roles_que_puede_simular(usuario):
    """None = a cualquiera; un conjunto = solo a esos roles; vacío = a nadie.

    La dirección comercial simula closers (pedido del 30/09/2026): para ver el mazo como lo ve cada
    uno. No simula setters ni a otra dirección, y menos a un admin.
    """
    from app.models.user import ROLE_ADMIN, ROLE_CLOSER, ROLE_DIRECTOR_COMERCIAL, ROLE_OPERATOR
    if usuario is None:
        return frozenset()
    if usuario.role in (ROLE_ADMIN, ROLE_OPERATOR):
        return None
    if usuario.role == ROLE_DIRECTOR_COMERCIAL:
        return frozenset({ROLE_CLOSER})
    return frozenset()


@bp.route('/auth/impersonate/closers', methods=['GET'])
@login_required
def closers_para_simular():
    """Los closers activos que quien está detrás de la sesión puede simular (el menú del dock de la
    dirección comercial). 403 para quien no simula closers."""
    from app.models.user import ROLE_CLOSER
    permitidos = _roles_que_puede_simular(_quien_simula())
    if permitidos is not None and ROLE_CLOSER not in permitidos:
        return jsonify({"message": "Forbidden"}), 403
    closers = db.session.scalars(
        sa.select(User).where(User.role == ROLE_CLOSER, User.is_active.is_(True)).order_by(User.username)
    ).all()
    return jsonify({"closers": [{"id": u.id, "username": u.username} for u in closers]}), 200


@bp.route('/auth/impersonate', methods=['POST'])
@login_required
def impersonate():
    from flask import session
    from app.models import get_impersonation_state

    # Puede simular admin u operator (a cualquiera) y la dirección comercial (solo a closers).
    # Quien ya está simulando puede cambiar de usuario sin volver, pero con lo que puede SU usuario
    # original (ver `_quien_simula`), no el simulado.
    is_impersonating, original_id, original_role = get_impersonation_state()
    permitidos = _roles_que_puede_simular(_quien_simula())
    if permitidos is not None and not permitidos:
        return jsonify({"message": "Forbidden"}), 403

    data = request.get_json() or {}
    target_user_id = data.get('user_id')
    # Pestaña aislada (clic derecho -> "Simular en pestaña nueva"): no toca la cookie de
    # sesión compartida por todo el navegador, solo emite un JWT propio de esa pestaña -
    # ver TokenPriorityLoginManager en app/__init__.py.
    isolated = bool(data.get('isolated'))

    if not target_user_id:
        return jsonify({"message": "User ID required"}), 400

    target_user = User.query.get(target_user_id)
    if not target_user:
        return jsonify({"message": "User not found"}), 404

    # Una persona con varios roles se simula con UNO a la vez: el que se elige (`role`, entre los que
    # de verdad tiene) o, sin elegir, su rol principal. Lo que puede simular quien está detrás se
    # decide por ese rol, no por los demás que la persona tenga.
    rol = data.get('role')
    if rol is not None and (not isinstance(rol, str) or not target_user.tiene_rol(rol)):
        return jsonify({"message": "Rol no válido para esa persona"}), 400
    rol = rol or target_user._role
    principal = rol == target_user._role
    if permitidos is not None and rol not in permitidos:
        return jsonify({"message": "Forbidden"}), 403
    if not target_user.is_active:
        return jsonify({"message": "User is inactive"}), 400

    if not is_impersonating:
        original_id, original_role = current_user.id, current_user.role

    if not isolated:
        # Flujo clásico: la misma pestaña se convierte en el usuario simulado vía cookie.
        if not session.get('is_impersonating'):
            session['original_user_id'] = current_user.id
            session['original_user_role'] = current_user.role
            session['is_impersonating'] = True
        login_user(target_user)
        if principal:
            session.pop('active_role', None)
        else:
            session['active_role'] = rol
    target_user.activar_rol(rol)

    # El estado de suplantación viaja en las claims del propio JWT (no en session) para que
    # cada pestaña con su propio token mantenga su propia identidad simulada.
    token = target_user.get_auth_token(
        is_impersonating=True,
        original_user_id=original_id,
        original_user_role=original_role,
        **({} if principal else {'active_role': rol}),
    )

    return jsonify({
        "message": f"Impersonating {target_user.username}",
        "token": token,
        "user": {
            "id": target_user.id,
            "username": target_user.username,
            "role": target_user.role,
            "email": target_user.email,
            "is_impersonating": True,
            "original_user_role": original_role,
            "can_view_finance": getattr(target_user, 'can_view_finance', False),
            "mascota": target_user.mascota,
        }
    }), 200

@bp.route('/auth/revert', methods=['POST'])
@login_required
def revert_impersonation():
    from flask import session
    from app.models import get_impersonation_state

    is_impersonating, original_user_id, _ = get_impersonation_state()

    if not is_impersonating:
        return jsonify({"message": "Not impersonating"}), 400

    if not original_user_id:
         # Fallback if session corrupted, logout
         logout_user()
         session.pop('original_user_id', None)
         session.pop('original_user_role', None)
         session.pop('is_impersonating', None)
         return jsonify({"message": "Session lost, logged out"}), 200

    original_user = User.query.get(original_user_id)
    if not original_user:
        logout_user()
        session.pop('original_user_id', None)
        session.pop('original_user_role', None)
        session.pop('is_impersonating', None)
        return jsonify({"message": "Original user not found, logged out"}), 200

    if session.get('is_impersonating'):
        # Solo restaurar/limpiar la sesión de cookie si el flujo clásico la usó - una pestaña
        # aislada (JWT en sessionStorage) nunca la tocó y revertir ahí no debe empezar a hacerlo.
        login_user(original_user)
        session.pop('active_role', None)
        session.pop('original_user_id', None)
        session.pop('original_user_role', None)
        session.pop('is_impersonating', None)

    # Token limpio (sin claims de suplantación) para la identidad original.
    token = original_user.get_auth_token()

    return jsonify({
        "message": "Reverted to original session",
        "token": token,
        "user": {
            "id": original_user.id,
            "username": original_user.username,
            "role": original_user.role,
            "email": original_user.email,
            "can_view_finance": getattr(original_user, 'can_view_finance', False),
            "cuentas_vinculadas": cuentas_de(original_user),
        }
    }), 200


@bp.route('/auth/switch-role', methods=['POST'])
@login_required
def switch_role():
    """Cambia de rol: a otro rol de la MISMA cuenta (`{role}`) o a otra cuenta vinculada (`{user_id}`).

    No es una suplantación: el token no lleva claims de `is_impersonating`, así que no hay «Volver a
    mi sesión» y se puede cambiar de ida y vuelta. Solo se llega a cuentas activas enlazadas por
    `persona_id`; quien está simulando a otro usuario tiene que volver a su sesión antes.
    """
    from flask import session
    from app.models import get_impersonation_state

    is_impersonating, _, _ = get_impersonation_state()
    if is_impersonating:
        return jsonify({"message": "Volvé a tu sesión antes de cambiar de rol."}), 400

    data = request.get_json() or {}
    if not isinstance(data, dict):
        data = {}

    # Otro ROL de la misma cuenta: es el mismo usuario con otro rol. El rol activo viaja en el
    # token (`active_role`), y en la sesión de cookie si no es una pestaña aislada. Se valida contra los
    # roles que la persona de verdad tiene.
    if 'role' in data:
        rol = data.get('role')
        if not isinstance(rol, str) or not current_user.tiene_rol(rol):
            return jsonify({"message": "Forbidden"}), 403
        principal = rol == current_user._role
        if not bool(data.get('isolated')):
            if principal:
                session.pop('active_role', None)
            else:
                session['active_role'] = rol
        current_user.activar_rol(rol)
        return jsonify({
            "message": f"Ahora estás como {rol}",
            "token": current_user.get_auth_token(**({} if principal else {'active_role': rol})),
            "user": _usuario_json(current_user),
        }), 200

    destino_id = data.get('user_id')
    if not isinstance(destino_id, int) or isinstance(destino_id, bool):
        return jsonify({"message": "User ID required"}), 400
    destino = db.session.get(User, destino_id)
    if not puede_cambiar_a(current_user, destino):
        return jsonify({"message": "Forbidden"}), 403

    # Pestaña aislada: solo se emite el JWT, la cookie compartida del navegador no se toca (igual que
    # la suplantación en pestaña nueva, ver TokenPriorityLoginManager).
    if not bool(data.get('isolated')):
        login_user(destino)
        for clave in ('original_user_id', 'original_user_role', 'is_impersonating', 'active_role'):
            session.pop(clave, None)

    return jsonify({
        "message": f"Ahora estás como {destino.username}",
        "token": destino.get_auth_token(),
        "user": _usuario_json(destino),
    }), 200


@bp.route('/auth/personas', methods=['GET'])
@operator_required
def personas_vinculadas():
    """Las personas con varias cuentas (gestión de operadores)."""
    return jsonify({"personas": listar_personas()}), 200


@bp.route('/auth/personas/vincular', methods=['POST'])
@operator_required
def vincular_cuentas():
    data = request.get_json() or {}
    ids = data.get('user_ids') if isinstance(data, dict) else None
    if not isinstance(ids, list) or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
        return jsonify({"message": "user_ids debe ser una lista de ids"}), 400
    try:
        persona = vincular(ids)
    except VinculoInvalido as e:
        return jsonify({"message": str(e)}), 400
    return jsonify({"persona_id": persona, "personas": listar_personas()}), 200


@bp.route('/auth/personas/desvincular', methods=['POST'])
@operator_required
def desvincular_cuenta():
    data = request.get_json() or {}
    user_id = data.get('user_id') if isinstance(data, dict) else None
    if not isinstance(user_id, int) or isinstance(user_id, bool):
        return jsonify({"message": "user_id requerido"}), 400
    try:
        desvincular(user_id)
    except VinculoInvalido as e:
        return jsonify({"message": str(e)}), 400
    return jsonify({"personas": listar_personas()}), 200


@bp.route('/auth/debug', methods=['GET'])
def debug_auth():
    """
    Debug endpoint to check what the server receives.
    Helpful for diagnosing 401/Cookie issues.
    """
    from flask import session
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ['authorization', 'cookie']} # Sanitize
    cookies = request.cookies
    
    return jsonify({
        "status": "ok",
        "is_authenticated": current_user.is_authenticated,
        "user_id": getattr(current_user, 'id', None),
        "user_role": getattr(current_user, 'role', None),
        "session_keys": list(session.keys()),
        "cookies_received": list(cookies.keys()),
        "cookie_details": {k: v[:5] + "***" for k, v in cookies.items() if 'session' in k}, # Show partial session cookie
        "origin": request.headers.get('Origin'),
        "referer": request.headers.get('Referer'),
        "headers": headers
    }), 200

@bp.route('/auth/csrf-token', methods=['GET'])
def get_csrf_token():
    """
    Suministra un token CSRF valido al cliente.
    Indispensable para futuras validaciones de peticiones POST/PUT/DELETE.
    """
    from flask_wtf.csrf import generate_csrf
    return jsonify({"csrf_token": generate_csrf()}), 200

