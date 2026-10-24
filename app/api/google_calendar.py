"""Conectar Google Calendar: el usuario da permiso en Google, vuelve a /google/callback y se guarda
su token. Ver app/services/google_service.py para las variables de entorno."""

import calendar
import os
import re
import time

from flask import Blueprint, current_app, jsonify, redirect, request, session
from flask_login import current_user, login_required

from app.models import db, GoogleCalendarToken
from app.services.google_service import GoogleService

bp = Blueprint('google_calendar_bp', __name__)

# Solo en local: oauthlib exige https, y el servidor de desarrollo corre en http.
if os.environ.get('FLASK_ENV') != 'production':
    os.environ.setdefault('OAUTHLIB_INSECURE_TRANSPORT', '1')
# Google puede devolver scopes de más (p. ej. calendar.readonly si ya los había dado antes).
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'


# Una ruta interna simple ("/admin/comercial"): nada de dominios, "//" ni parámetros, para que
# `volver` no sirva de redirección abierta.
_RUTA_INTERNA = re.compile(r'^/(?!/)[A-Za-z0-9/_-]*$')


def _volver(resultado):
    """A la pantalla desde donde se conecta, con la Configuración abierta en Integraciones. Mismo
    dominio que el backend salvo en local, donde FRONTEND_URL apunta al servidor de Vite."""
    base = os.environ.get('FRONTEND_URL', '').rstrip('/')
    volver = session.pop('google_volver', None)
    if volver == 'agendamiento':
        destino = '/agendas-v2?config=integraciones&'
    elif volver and _RUTA_INTERNA.match(volver):
        destino = f'{volver}?vista=configuracion&'
    else:
        destino = '/closer/deck?vista=configuracion&'
    return redirect(f'{base}{destino}google_connected={resultado}')


# --- Conectar desde la Academia ---------------------------------------------------------------
# El equipo de fulfillment no entra a NeurOPS: la Academia pide un link firmado (app/api/external/agenda.py),
# la persona lo abre, da el permiso en Google y vuelve a la Academia. La firma no es un JWT a propósito:
# load_user_from_request toma cualquier JWT con `id` como sesión.
SAL_CONECTAR = 'academia-google'
VIGENCIA_CONECTAR_S = 15 * 60
ACADEMY_URL_POR_DEFECTO = 'https://academy.thelearnation.com'


def _firmador():
    from itsdangerous import URLSafeTimedSerializer

    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SAL_CONECTAR)


def link_para_conectar(user_id, volver):
    """URL para que esa cuenta conecte su Google Calendar sin sesión. Vence a los 15 minutos y sirve una
    sola vez: después de conectar, la misma firma ya no abre nada. `volver`: ruta de la Academia."""
    volver = volver if volver and _RUTA_INTERNA.match(volver) else '/'
    firma = _firmador().dumps({'u': user_id, 'v': volver, 't': int(time.time())})
    return request.host_url.rstrip('/') + '/google/conectar/' + firma


def _a_la_academia(volver, resultado):
    base = os.environ.get('ACADEMY_URL', ACADEMY_URL_POR_DEFECTO).rstrip('/')
    return redirect(f'{base}{volver}?google={resultado}')


@bp.route('/google/conectar/<firma>', methods=['GET'])
def conectar_desde_la_academia(firma):
    from itsdangerous import BadSignature

    from app.models.user import ROLE_FULFILLMENT, User

    try:
        datos = _firmador().loads(firma, max_age=VIGENCIA_CONECTAR_S)
    except BadSignature:  # también la vencida (SignatureExpired)
        return 'El link para conectar Google venció. Pedí uno nuevo desde la Academia.', 400
    usuario = db.session.get(User, datos.get('u'))
    if usuario is None or not usuario.is_active or not usuario.tiene_rol(ROLE_FULFILLMENT):
        return 'Este link no es válido.', 400
    token = GoogleCalendarToken.query.filter_by(user_id=usuario.id).first()
    if token and token.updated_at and calendar.timegm(token.updated_at.timetuple()) >= datos.get('t', 0):
        return 'Este link ya se usó. Pedí uno nuevo desde la Academia.', 400
    redirect_uri = GoogleService.redirect_uri()
    flow = GoogleService.get_flow(redirect_uri)
    auth_url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true', prompt='consent')
    session['google_oauth_state'] = state
    session['google_redirect_uri'] = redirect_uri
    session.pop('google_oauth_proposito', None)
    session['google_conectar'] = {'u': usuario.id, 'v': datos.get('v') or '/'}
    return redirect(auth_url)


def _vuelta_a_la_academia(conectar, state, redirect_uri):
    volver = conectar.get('v') or '/'
    if request.args.get('error'):
        return _a_la_academia(volver, 'cancelado')
    if not state or not redirect_uri or request.args.get('state') != state:
        return _a_la_academia(volver, 'error')
    try:
        flow = GoogleService.get_flow(redirect_uri)
        flow.fetch_token(authorization_response=request.url)
    except Exception as e:  # noqa: BLE001  (código vencido, cliente mal configurado, red...)
        current_app.logger.warning(f'[GOOGLE] No se pudo conectar el calendario del usuario #{conectar.get("u")}: {e}')
        return _a_la_academia(volver, 'error')
    GoogleService.save_credentials(conectar['u'], flow.credentials)
    return _a_la_academia(volver, 'ok')


@bp.route('/api/google/login', methods=['GET'])
@login_required
def login():
    redirect_uri = GoogleService.redirect_uri()
    flow = GoogleService.get_flow(redirect_uri)
    auth_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',  # siempre pide el permiso: así Google devuelve un refresh token
    )
    session['google_oauth_state'] = state
    session['google_redirect_uri'] = redirect_uri
    session.pop('google_oauth_proposito', None)  # es conectar el calendario, no entrar con Google
    session.pop('google_conectar', None)  # ni el de una cuenta de la Academia que quedó a medias
    # ?volver=agendamiento: se conecta desde la Configuración de Agendamiento y vuelve ahí. Con una
    # ruta ("/admin/comercial"), vuelve a esa pantalla con la Configuración abierta (sesion/).
    volver = request.args.get('volver')
    if volver == 'agendamiento' or (volver and _RUTA_INTERNA.match(volver)):
        session['google_volver'] = volver
    else:
        session.pop('google_volver', None)
    return jsonify({'auth_url': auth_url})


def _vuelta_del_login(state, redirect_uri):
    """Entrar con Google (app/services/login_google.py). Vuelve a /login con el resultado; si entró,
    la pantalla de login canjea la sesión por el token con POST /api/auth/google/sesion."""
    from flask_login import login_user

    from app.services import login_google

    base = os.environ.get('FRONTEND_URL', '').rstrip('/')
    # Si el login lo arrancó la app móvil (login_google.url_de_login con reto), la vuelta es a la app.
    reto_movil = session.pop('google_movil_reto', None)

    def a_login(resultado):
        if reto_movil:
            return _a_la_app(f'error={resultado}')
        return redirect(f'{base}/login?google={resultado}')

    if request.args.get('error'):
        return a_login('cancelado')
    if not state or not redirect_uri or request.args.get('state') != state:
        return a_login('error')
    try:
        email = login_google.email_de_la_vuelta(redirect_uri, request.url)
    except Exception as e:  # noqa: BLE001  (código vencido, cliente mal configurado, red...)
        current_app.logger.warning(f'[GOOGLE] Falló el login con Google: {e}')
        return a_login('error')
    if not email:
        return a_login('sin_verificar')
    usuario = login_google.usuario_por_email(email)
    if usuario is None:
        return a_login('sin_cuenta')
    if not usuario.is_active:
        return a_login('desactivada')
    if reto_movil:
        return _a_la_app(f'code={login_google.generar_codigo_movil(usuario.id, reto_movil)}')
    login_user(usuario, remember=True)
    session.pop('active_role', None)  # se entra siempre con el rol principal, como con la clave
    session['google_login'] = usuario.id
    return a_login('ok')


def _a_la_app(query):
    """Vuelve a la app móvil por su esquema. Una página con enlace y redirección por JS, no un 302: los
    navegadores embebidos a veces no siguen un 302 a un esquema propio."""
    from app.services import login_google

    destino = f'{login_google.ESQUEMA_MOVIL}://auth?{query}'
    html = ('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
            '<title>Learnation</title><body style="font-family:sans-serif;text-align:center;padding:48px">'
            '<p>Volviendo a la app…</p>'
            f'<p><a href="{destino}">Abrir Learnation</a></p>'
            f'<script>location.replace({destino!r})</script></body>')
    return html, 200, {'Content-Type': 'text/html; charset=utf-8'}


@bp.route('/google/callback', methods=['GET'])
def callback():
    state = session.pop('google_oauth_state', None)
    redirect_uri = session.pop('google_redirect_uri', None)
    if session.pop('google_oauth_proposito', None) == 'login':
        return _vuelta_del_login(state, redirect_uri)
    conectar = session.pop('google_conectar', None)
    if conectar:
        return _vuelta_a_la_academia(conectar, state, redirect_uri)
    if not current_user.is_authenticated:
        return 'Tu sesión se cerró mientras conectabas Google. Volvé a entrar y probá de nuevo.', 401
    if request.args.get('error'):  # el usuario canceló en la pantalla de Google
        return _volver('cancelado')
    if not state or not redirect_uri or request.args.get('state') != state:
        return _volver('error')
    try:
        flow = GoogleService.get_flow(redirect_uri)
        flow.fetch_token(authorization_response=request.url)
    except Exception as e:  # noqa: BLE001  (código vencido, cliente mal configurado, red...)
        current_app.logger.warning(f'[GOOGLE] No se pudo conectar el calendario del usuario #{current_user.id}: {e}')
        return _volver('error')
    GoogleService.save_credentials(current_user.id, flow.credentials)
    return _volver('success')


@bp.route('/api/google/calendars', methods=['GET', 'POST'])
@login_required
def manage_calendars():
    if request.method == 'POST':
        # {calendar_id}: el calendario de destino. {conflicto: [ids]}: en cuáles se revisan los conflictos.
        datos = request.get_json(silent=True) or {}
        calendar_id, conflicto = datos.get('calendar_id'), datos.get('conflicto')
        if not calendar_id and not isinstance(conflicto, list):
            return jsonify({'error': 'Missing calendar_id'}), 400
        token = GoogleService.token_vigente(current_user.id)
        if not token:
            return jsonify({'error': 'No token found'}), 404
        if calendar_id:
            token.google_calendar_id = calendar_id
        if isinstance(conflicto, list):
            token.calendarios_conflicto = [c for c in conflicto if isinstance(c, str) and c][:20]
        db.session.commit()
        return jsonify({'message': 'Calendar preference saved', 'conflicto': GoogleService.calendarios_de_conflicto(token)}), 200

    # GET. Con ?solo_estado=1 responde desde la base, sin llamar a Google (el aviso del menú).
    token = GoogleCalendarToken.query.filter_by(user_id=current_user.id).first()
    if request.args.get('solo_estado'):
        return jsonify({'connected': bool(token and token.vencido_en is None), 'vencido': bool(token and token.vencido_en)}), 200

    todos = GoogleService.list_calendars(current_user.id, todos=True)  # si Google rechaza el token, lo marca vencido
    if not token or token.vencido_en is not None:
        return jsonify({'connected': False, 'vencido': bool(token)}), 200
    return jsonify({
        'connected': True,
        'vencido': False,
        'selected_calendar': token.google_calendar_id,
        'calendars': [c for c in todos if c.get('escribe')],  # el de destino tiene que ser uno donde escribe
        'todos': todos,  # para revisar conflictos alcanza con poder leerlo
        'conflicto': GoogleService.calendarios_de_conflicto(token),
    }), 200


@bp.route('/api/google/disconnect', methods=['POST'])
@login_required
def disconnect():
    GoogleCalendarToken.query.filter_by(user_id=current_user.id).delete()
    db.session.commit()
    return jsonify({'message': 'Disconnected'}), 200
