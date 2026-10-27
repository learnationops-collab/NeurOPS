from flask import Blueprint, jsonify

bp = Blueprint('api', __name__)

@bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "Learnation API"}), 200

# Import sub-routes
from app.api import auth, admin, leadership
from app.api import auth_google_movil  # noqa: F401  (rutas sobre el mismo blueprint)

@bp.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@bp.after_app_request
def cabeceras_de_seguridad(response):
    # frame-ancestors y CSP todavía no: la reserva puede estar embebida en alguna landing.
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.setdefault('Strict-Transport-Security', 'max-age=31536000')
    return response
