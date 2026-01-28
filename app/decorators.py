from functools import wraps
from flask import flash, redirect, url_for
from flask_login import login_required, current_user

def role_required(role):
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated_function(*args, **kwargs):
            if current_user.role != role:
                flash('No tienes permiso para acceder a esta página.')
                return redirect(url_for('main.index'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def admin_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        from app.models import ROLE_OPERATOR
        if current_user.role != 'admin' and current_user.role != ROLE_OPERATOR:
            from flask import request, jsonify
            if request.path.startswith('/api/'):
                return jsonify({"error": "Admin role required"}), 403
            flash('No tienes permiso para acceder a esta página.')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return decorated_function
