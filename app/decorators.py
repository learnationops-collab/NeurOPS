from functools import wraps
from flask import flash, redirect, url_for
from flask_login import login_required, current_user

def role_required(role):
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated_function(*args, **kwargs):
            if current_user.role != role:
                from flask import request, jsonify
                if request.path.startswith('/api/'):
                    return jsonify({"error": f"Role {role} required"}), 403
                flash('No tienes permiso para acceder a esta página.')
                return redirect(url_for('main.index'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def admin_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        from app.models.user import ROLE_OPERATOR, ROLE_SALES_ADMIN
        if current_user.role not in ['admin', ROLE_OPERATOR, ROLE_SALES_ADMIN]:
            from flask import request, jsonify
            if request.path.startswith('/api/'):
                return jsonify({"error": "Admin role required"}), 403
            flash('No tienes permiso para acceder a esta página.')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return decorated_function

def operator_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        from app.models.user import ROLE_OPERATOR
        if current_user.role not in ['admin', ROLE_OPERATOR]:
            from flask import request, jsonify
            if request.path.startswith('/api/'):
                return jsonify({"error": "Operator access required"}), 403
            flash('No tienes permiso para acceder a esta página.')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return decorated_function
