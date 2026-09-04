from functools import wraps
from flask import flash, redirect, url_for, request, jsonify
from flask_login import current_user
import traceback

def role_required(role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                if not current_user.is_authenticated:
                    if request.path.startswith('/api/'):
                        return jsonify({"error": "Authentication required"}), 401
                    return redirect(url_for('auth.login'))

                if current_user.role != role:
                    if request.path.startswith('/api/'):
                        return jsonify({"error": f"Role {role} required"}), 403
                    flash('No tienes permiso para acceder a esta página.')
                    return redirect('/')
                    
                return f(*args, **kwargs)
            except Exception as e:
                return jsonify({
                    "message": f"Server Error in role check: {str(e)}", 
                    "trace": traceback.format_exc()
                }), 500
        return decorated_function
    return decorator

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            from app.models.user import ROLE_OPERATOR
            
            if not current_user.is_authenticated:
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Authentication required"}), 401
                return redirect(url_for('auth.login'))

            if current_user.role not in ['admin', ROLE_OPERATOR]:
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Admin role required"}), 403
                flash('No tienes permiso para acceder a esta página.')
                return redirect('/')
                
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({
                "message": f"Server Error in admin check: {str(e)}", 
                "trace": traceback.format_exc()
            }), 500
    return decorated_function

def workshop_required(f):
    """Acceso al módulo de Workshop Intelligence (`/admin/workshops` y su API):
    admin, operator y el rol director_marketing (analiza el embudo de talleres
    a fondo, pero no debe heredar el resto de `admin_required` — finanzas,
    equipo, base de datos — que no se le pidió)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            from app.models.user import ROLE_OPERATOR, ROLE_DIRECTOR_MARKETING

            if not current_user.is_authenticated:
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Authentication required"}), 401
                return redirect(url_for('auth.login'))

            if current_user.role not in ['admin', ROLE_OPERATOR, ROLE_DIRECTOR_MARKETING]:
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Workshop access required"}), 403
                flash('No tienes permiso para acceder a esta página.')
                return redirect('/')

            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({
                "message": f"Server Error in workshop check: {str(e)}",
                "trace": traceback.format_exc()
            }), 500
    return decorated_function

def operator_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            from app.models.user import ROLE_OPERATOR
            
            if not current_user.is_authenticated:
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Authentication required"}), 401
                return redirect(url_for('auth.login'))

            if current_user.role not in ['admin', ROLE_OPERATOR]:
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Operator access required"}), 403
                flash('No tienes permiso para acceder a esta página.')
                return redirect('/')
                
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({
                "message": f"Server Error in operator check: {str(e)}", 
                "trace": traceback.format_exc()
            }), 500
    return decorated_function
