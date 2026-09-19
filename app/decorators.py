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

from flask import current_app, flash, jsonify, redirect, request
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


# Un secreto de menos caracteres que esto no es un secreto: se rechaza al configurarlo.
LARGO_MINIMO_DE_SECRETO = 20

# Modo de migracion (INTEGRATIONS_AUTH_MODE=log_only): valvula para desplegar la proteccion de las
# integraciones sin cortar flujos que todavia no mandan su secreto (n8n, Apps Script, ManyChat, crons). En
# ese modo lo que se habria rechazado PASA, pero queda registrado con la ruta y el origen para localizar a
# quien falta configurar; quitar la variable lo vuelve obligatorio. Es opt-in: sin ella todo falla cerrado.
MODO_DE_MIGRACION = 'log_only'


def en_modo_de_migracion():
    return os.environ.get('INTEGRATIONS_AUTH_MODE', '').strip().lower() == MODO_DE_MIGRACION


def _origen_y_agente():
    """Quien llama, para el registro: el primer origen de X-Forwarded-For (lo pone el proxy, pero un cliente
    puede falsearlo: es solo informativo) y el agente, recortado."""
    origen = (request.headers.get('X-Forwarded-For') or request.remote_addr or '?').split(',')[0].strip()
    return origen, (request.headers.get('User-Agent') or '?')[:80]


def avisar_llamada_sin_credencial(motivo):
    """Registra una llamada que el modo de migracion dejo pasar. Nunca escribe secretos ni la cadena de
    consulta (request.path no la incluye): solo metodo, ruta, motivo, origen y agente."""
    origen, agente = _origen_y_agente()
    current_app.logger.warning(
        '[MIGRACION DE SECRETOS] %s %s pasa SIN credencial valida (%s) desde %r, agente %r. Configura el secreto '
        'en quien llama y quita INTEGRATIONS_AUTH_MODE para que sea obligatorio.',
        request.method, request.path, motivo, origen, agente)


def registrar_rechazo_de_integracion(motivo):
    """Registra una llamada de un sistema externo que se RECHAZO: tras desplegar, el log muestra de
    inmediato a quien le falta el secreto (o lo manda mal). Solo metodo, ruta, motivo, origen y agente."""
    origen, agente = _origen_y_agente()
    current_app.logger.warning(
        '[INTEGRACION RECHAZADA] %s %s (%s) desde %r, agente %r. Si es un sistema legitimo le falta su '
        'secreto: configuralo o activa INTEGRATIONS_AUTH_MODE=log_only mientras migras.',
        request.method, request.path, motivo, origen, agente)


def _comprobar_secreto(variable_de_entorno, leer_secreto):
    """(None, None) si el secreto es correcto; si no, (respuesta de error, motivo para el registro)."""
    esperado = os.environ.get(variable_de_entorno, '')
    if len(esperado) < LARGO_MINIMO_DE_SECRETO:
        respuesta = jsonify({
            "status": "error",
            "message": f"Integración no configurada: define {variable_de_entorno} "
                       f"(mínimo {LARGO_MINIMO_DE_SECRETO} caracteres)",
        }), 503
        return respuesta, f'{variable_de_entorno} sin configurar'

    provisto = leer_secreto()
    if not provisto:
        return (jsonify({"status": "error", "message": "Unauthorized"}), 401), 'no presento el secreto'
    if not _iguales_en_tiempo_constante(provisto, esperado):
        return (jsonify({"status": "error", "message": "Unauthorized"}), 401), 'secreto incorrecto'
    return None, None


def _requiere_secreto_compartido(variable_de_entorno, leer_secreto):
    """Ruta de una integracion que llama sin usuario (un cron, un webhook) e identifica con un secreto.

    Falla CERRADA: sin la variable de entorno, o con un valor demasiado corto para ser un secreto, la
    ruta contesta 503 y no existe un valor por defecto que sirva. Antes cada ruta traia uno escrito en el
    codigo, es decir, conocido por cualquiera con acceso al repositorio y imposible de rotar sin
    desplegar. `leer_secreto()` saca de la peticion el secreto presentado (o '' si no vino). Solo el modo de
    migracion (INTEGRATIONS_AUTH_MODE=log_only) deja pasar lo que se habria rechazado, y lo registra."""
    def decorador(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            rechazo, motivo = _comprobar_secreto(variable_de_entorno, leer_secreto)
            if rechazo is not None:
                if not en_modo_de_migracion():
                    registrar_rechazo_de_integracion(motivo)
                    return rechazo
                avisar_llamada_sin_credencial(motivo)
            return f(*args, **kwargs)
        return decorated_function
    return decorador


def _secreto_de_cron():
    """Bearer del header Authorization (no queda en los logs de acceso) o, por compatibilidad con los
    crons ya configurados, el parametro ?token=."""
    cabecera = request.headers.get('Authorization', '')
    if cabecera.startswith('Bearer '):
        return cabecera[len('Bearer '):].strip()
    return request.args.get('token', '')


# Crons externos (sincronizacion de Google Sheets y recordatorios de seguimiento por WhatsApp).
require_cron_secret = _requiere_secreto_compartido('CRON_SECRET', _secreto_de_cron)

# Webhook de ManyChat (leads de Instagram): ManyChat manda el secreto en el header X-ManyChat-Token.
require_manychat_token = _requiere_secreto_compartido(
    'MANYCHAT_WEBHOOK_TOKEN', lambda: request.headers.get('X-ManyChat-Token', ''))
