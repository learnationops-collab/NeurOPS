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
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"message": "Username and password required"}), 400

    # 1. Find User
    user = db.session.scalar(sa.select(User).where(User.username == username))
    
    # 2. Try Email if username failed
    if not user:
        user = db.session.scalar(sa.select(User).where(User.email == username))

    # 3. Validate
    if user is None or not user.check_password(password):
        return jsonify({"message": "Invalid credentials"}), 401

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
    
    from flask import session
    is_impersonating = session.get('is_impersonating', False)
    original_user_role = session.get('original_user_role', None)

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

@bp.route('/auth/impersonate', methods=['POST'])
@login_required
def impersonate():
    from flask import session
    from app.models import ROLE_OPERATOR, ROLE_ADMIN
    
    # Check if user is allowed to impersonate
    # Must be ADMIN or OPERATOR OR already impersonating (to switch between users directly)
    original_role = session.get('original_user_role')
    is_impersonating = session.get('is_impersonating')
    
    if current_user.role not in [ROLE_ADMIN, ROLE_OPERATOR] and not is_impersonating:
        return jsonify({"message": "Forbidden"}), 403

    data = request.get_json() or {}
    target_user_id = data.get('user_id')
    
    if not target_user_id:
        return jsonify({"message": "User ID required"}), 400

    target_user = User.query.get(target_user_id)
    if not target_user:
        return jsonify({"message": "User not found"}), 404

    # Store original session data ONLY if not already impersonating
    if not is_impersonating:
        session['original_user_id'] = current_user.id
        session['original_user_role'] = current_user.role
        session['is_impersonating'] = True

    # Log in as the target user without requiring password
    login_user(target_user)
    
    # Generate token for the target user (Sync for frontend)
    token = target_user.get_auth_token()

    return jsonify({
        "message": f"Impersonating {target_user.username}",
        "token": token,
        "user": {
            "id": target_user.id,
            "username": target_user.username,
            "role": target_user.role,
            "email": target_user.email,
            "is_impersonating": True,
            "original_user_role": session.get('original_user_role'),
            "can_view_finance": getattr(target_user, 'can_view_finance', False)
        }
    }), 200

@bp.route('/auth/revert', methods=['POST'])
@login_required
def revert_impersonation():
    from flask import session
    
    if not session.get('is_impersonating'):
        return jsonify({"message": "Not impersonating"}), 400
        
    original_user_id = session.get('original_user_id')
    if not original_user_id:
         # Fallback if session corrupted, logout
         logout_user()
         return jsonify({"message": "Session lost, logged out"}), 200

    original_user = User.query.get(original_user_id)
    if not original_user:
        logout_user()
        return jsonify({"message": "Original user not found, logged out"}), 200
        
    # Restore original session
    login_user(original_user)
    
    # Generate token for the original user
    token = original_user.get_auth_token()
    
    # Clear impersonation flags
    session.pop('original_user_id', None)
    session.pop('original_user_role', None)
    session.pop('is_impersonating', None)
    
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

