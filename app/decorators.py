"""Control de acceso de las rutas: rol del usuario logueado y tokens de las cuentas de servicio.

Los decoradores de rol solo envuelven la COMPROBACION de acceso: la vista se ejecuta fuera de
cualquier try/except. Antes la vista tambien quedaba dentro, asi que un abort(404) (get_or_404)
salia como HTTP 500 y una excepcion devolvia al cliente el mensaje y el traceback completo, con
rutas del servidor. Ahora el abort conserva su codigo y una excepcion llega al manejador de errores
de la app, que fuera de debug contesta un JSON generico.
"""
import hmac
import os
from functools import wraps

from flask import flash, jsonify, redirect, request
from flask_login import current_user

from app.models.user import ROLE_DIRECTOR_MARKETING, ROLE_HIRING, ROLE_OPERATOR

ROLE_ADMIN = 'admin'


def _acceso_denegado(roles_permitidos, mensaje):
    """None si el usuario logueado tiene alguno de los roles; si no, la respuesta a devolver."""
    es_api = request.path.startswith('/api/')
    if not current_user.is_authenticated:
        if es_api:
            return jsonify({"error": "Authentication required"}), 401
        return redirect('/login')  # la pantalla de login de la SPA

    if current_user.role not in roles_permitidos:
        if es_api:
            return jsonify({"error": mensaje}), 403
        flash('No tienes permiso para acceder a esta página.')
        return redirect('/')
    return None


def _requiere_roles(roles_permitidos, mensaje):
    def decorador(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            denegado = _acceso_denegado(roles_permitidos, mensaje)
            return denegado if denegado is not None else f(*args, **kwargs)
        return decorated_function
    return decorador


def role_required(role):
    """Exactamente ese rol (admin y operator no heredan el acceso a una ruta de otro rol)."""
    return _requiere_roles((role,), f"Role {role} required")


admin_required = _requiere_roles((ROLE_ADMIN, ROLE_OPERATOR), "Admin role required")

operator_required = _requiere_roles((ROLE_ADMIN, ROLE_OPERATOR), "Operator access required")

# Acceso al modulo de Workshop Intelligence (`/admin/workshops` y su API): admin, operator y el rol
# director_marketing (analiza el embudo de talleres a fondo, pero no debe heredar el resto de
# `admin_required` — finanzas, equipo, base de datos — que no se le pidio).
workshop_required = _requiere_roles(
    (ROLE_ADMIN, ROLE_OPERATOR, ROLE_DIRECTOR_MARKETING), "Workshop access required")

# Acceso al panel de contratacion (`/admin/hiring` y su API): admin y el rol hiring (revisa las
# postulaciones a Asistente Administrativa y Personal, pero no debe heredar el resto de
# `admin_required` — finanzas, equipo, base de datos — que no se le pidio).
hiring_required = _requiere_roles((ROLE_ADMIN, ROLE_HIRING), "Hiring access required")


def _iguales_en_tiempo_constante(provisto, esperado):
    """Igualdad sin filtrar por tiempo cuantos caracteres coinciden. Se compara sobre bytes: con str,
    un caracter no ASCII lanza TypeError y produce un 500 en vez de un 401."""
    return hmac.compare_digest(provisto.encode('utf-8'), esperado.encode('utf-8'))


def _requiere_token_bearer(variable_de_entorno, con_success):
    """'Authorization: Bearer <token>' contra una variable de entorno (no hay usuario detras).

    Sin la variable la integracion queda CERRADA (500), nunca abierta. `con_success` agrega
    "success": false al cuerpo de los errores (formato de la plataforma de desarrollo)."""
    def decorador(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            def error(mensaje, codigo):
                cuerpo = {"success": False, "error": mensaje} if con_success else {"error": mensaje}
                return jsonify(cuerpo), codigo

            esperado = os.environ.get(variable_de_entorno)
            if not esperado:
                return error(f"Integración no configurada (falta {variable_de_entorno})", 500)

            cabecera = request.headers.get('Authorization', '')
            if not cabecera.startswith('Bearer '):
                return error("Falta el header Authorization: Bearer <token>", 401)

            if not _iguales_en_tiempo_constante(cabecera[len('Bearer '):].strip(), esperado):
                return error("Token inválido", 401)

            return f(*args, **kwargs)
        return decorated_function
    return decorador


# Autenticacion de la Academia (academy.thelearnation.com) consultando NeurOPS - direccion inversa al
# ACADEMY_API_TOKEN que usa LearnationService. Ver docs/academy_consulta_ventas.md.
require_academy_token = _requiere_token_bearer('ACADEMY_INBOUND_API_TOKEN', con_success=False)

# Autenticacion de la plataforma de gestion de trabajo del equipo (consumidora externa, repo aparte)
# que consulta y actualiza bug reports de NeurOPS. Ver docs/dev_platform_bug_reports.md.
require_dev_platform_token = _requiere_token_bearer('DEV_PLATFORM_INBOUND_API_TOKEN', con_success=True)
