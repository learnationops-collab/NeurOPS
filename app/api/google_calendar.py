"""Conectar Google Calendar: el usuario da permiso en Google, vuelve a /google/callback y se guarda
su token. Ver app/services/google_service.py para las variables de entorno."""

import os
import re

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

    def a_login(resultado):
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
    login_user(usuario, remember=True)
    session.pop('active_role', None)  # se entra siempre con el rol principal, como con la clave
    session['google_login'] = usuario.id
    return a_login('ok')


@bp.route('/google/callback', methods=['GET'])
def callback():
    state = session.pop('google_oauth_state', None)
    redirect_uri = session.pop('google_redirect_uri', None)
    if session.pop('google_oauth_proposito', None) == 'login':
        return _vuelta_del_login(state, redirect_uri)
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
