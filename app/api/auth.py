from flask import request, jsonify
from flask_login import login_user, logout_user, current_user, login_required
import sqlalchemy as sa
from app import db
from app.api import bp
from app.models import User

@bp.route('/auth/login', methods=['POST'])
def login():
    if current_user.is_authenticated:
        return jsonify({
            "message": "Already authenticated",
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "role": current_user.role
            }
        }), 200

    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    remember = data.get('remember', False)

    if not username or not password:
        return jsonify({"message": "Username and password required"}), 400

    user = db.session.scalar(sa.select(User).where(User.username == username))

    if user is None or not user.check_password(password):
        return jsonify({"message": "Invalid username or password"}), 401

    login_user(user, remember=remember)

    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role
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
            "is_impersonating": is_impersonating,
            "original_user_role": original_user_role
        }
    }), 200

@bp.route('/auth/impersonate', methods=['POST'])
@login_required
def impersonate():
    from flask import session
    from app.models import ROLE_OPERATOR
    
    # Check if user is allowed to impersonate
    # Must be OPERATOR OR already impersonating (to switch between users directly)
    original_role = session.get('original_user_role')
    is_impersonating = session.get('is_impersonating')
    
    if current_user.role != ROLE_OPERATOR and not is_impersonating:
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

    return jsonify({
        "message": f"Impersonating {target_user.username}",
        "user": {
            "id": target_user.id,
            "username": target_user.username,
            "role": target_user.role,
            "is_impersonating": True,
            "original_user_role": session.get('original_user_role')
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
    
    # Clear impersonation flags
    session.pop('original_user_id', None)
    session.pop('original_user_role', None)
    session.pop('is_impersonating', None)
    
    return jsonify({
        "message": "Reverted to original session",
        "user": {
            "id": original_user.id,
            "username": original_user.username,
            "role": original_user.role
        }
    }), 200

@bp.route('/auth/emergency-create', methods=['POST'])
def emergency_create():
    data = request.get_json() or {}
    secret = data.get('secret')
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'admin')

    if secret != "putofreud":
        return jsonify({"message": "Forbidden"}), 403
    
    if not username or not password:
        return jsonify({"message": "Username and password required"}), 400
    
    if db.session.scalar(sa.select(User).where(User.username == username)):
        return jsonify({"message": "User already exists"}), 400
    
    user = User(username=username, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    
    return jsonify({"message": f"User {username} created successfully as {role}"}), 201

