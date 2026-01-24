from flask import request, jsonify
from flask_login import login_user, logout_user, current_user
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
    
    return jsonify({
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "role": current_user.role
        }
    }), 200
