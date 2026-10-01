from flask import request, jsonify
from flask_login import login_user, logout_user, current_user, login_required
import sqlalchemy as sa
from app import db
from app.api import bp
from app.models import User

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
            "email": user.email,
            "can_view_finance": getattr(user, 'can_view_finance', False)
        }
    }), 200

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
            "email": current_user.email,
            "is_impersonating": is_impersonating,
            "original_user_role": original_user_role,
            "can_view_finance": getattr(current_user, 'can_view_finance', False)
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
    if permitidos is not None and target_user.role not in permitidos:
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

    # El estado de suplantación viaja en las claims del propio JWT (no en session) para que
    # cada pestaña con su propio token mantenga su propia identidad simulada.
    token = target_user.get_auth_token(
        is_impersonating=True,
        original_user_id=original_id,
        original_user_role=original_role,
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
            "can_view_finance": getattr(target_user, 'can_view_finance', False)
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
            "can_view_finance": getattr(original_user, 'can_view_finance', False)
        }
    }), 200


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

