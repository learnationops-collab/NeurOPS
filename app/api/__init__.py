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


# Quién puede mostrar Work dentro de un iframe: nadie de afuera (clickjacking), salvo la reserva pública, que
# una landing de Learnation puede embeber. Sin restringir scripts: la SPA y lo que carga de afuera seguirían
# andando igual, y un CSP de scripts mal medido rompe pantallas sin aviso.
EMBEBIBLES = ('/book/',)
ANCESTROS_DE_LANDING = "'self' https://*.thelearnation.com https://thelearnation.com"


@bp.after_app_request
def cabeceras_de_seguridad(response):
    from flask import request
    ancestros = ANCESTROS_DE_LANDING if request.path.startswith(EMBEBIBLES) else "'self'"
    response.headers.setdefault('Content-Security-Policy',
                                f"frame-ancestors {ancestros}; object-src 'none'; base-uri 'self'")
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.setdefault('Strict-Transport-Security', 'max-age=31536000')
    return response
