"""Conectar una cuenta de Google para un solo permiso (app/services/google_aparte.py): el correo (ADR-W123) y
la configuración de las reuniones de Meet (ADR-W128).

GET /google/<clave>/conectar/<firma>: el link firmado lleva a Google pidiendo solo ese permiso; la vuelta entra
por /google/callback (app/api/google_calendar.py) y termina en `vuelta_de_google`.
"""
from flask import Blueprint, abort, current_app, redirect, request, session

from app.services.google_aparte import POR_CLAVE
from app.services.google_service import GoogleService

bp = Blueprint('google_aparte', __name__)
SESION = 'google_aparte'


def _pagina(mensaje, codigo=200):
    html = ('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
            '<title>Conectar Google</title><body style="font-family:sans-serif;text-align:center;padding:48px">'
            f'<p>{mensaje}</p></body>')
    return html, codigo, {'Content-Type': 'text/html; charset=utf-8'}


@bp.route('/google/<clave>/conectar/<firma>', methods=['GET'])
def conectar(clave, firma):
    autorizacion = POR_CLAVE.get(clave)
    if not autorizacion:
        abort(404)
    motivo = autorizacion.leer_firma(firma)
    if motivo:
        return _pagina(motivo, 400)
    redirect_uri = GoogleService.redirect_uri()
    flow = GoogleService.get_flow(redirect_uri, scopes=autorizacion.scopes)
    # Sin include_granted_scopes: una autorización aparte, que no suma ni toca las de Calendar o Drive.
    auth_url, state = flow.authorization_url(access_type='offline', prompt='consent select_account')
    session['google_oauth_state'] = state
    session['google_redirect_uri'] = redirect_uri
    for otra in ('google_oauth_proposito', 'google_conectar', 'google_notas'):
        session.pop(otra, None)
    session[SESION] = clave
    return redirect(auth_url)


def vuelta_de_google(clave, state, redirect_uri):
    autorizacion = POR_CLAVE.get(clave)
    if not autorizacion:
        return _pagina('No se pudo conectar. Volvé a abrir el link.', 400)
    if request.args.get('error'):
        return _pagina('Se canceló la conexión. Podés volver a abrir el link para intentarlo de nuevo.')
    if not state or not redirect_uri or request.args.get('state') != state:
        return _pagina('No se pudo conectar: la sesión de Google no coincide. Volvé a abrir el link.', 400)
    try:
        flow = GoogleService.get_flow(redirect_uri, scopes=autorizacion.scopes)
        flow.fetch_token(authorization_response=request.url)
    except Exception as e:  # noqa: BLE001  (código vencido, permiso no otorgado, API apagada...)
        current_app.logger.warning(f'[{clave.upper()}] No se pudo conectar: {e}')
        return _pagina('No se pudo conectar. Revisá que hayas aceptado el permiso que pide y probá de nuevo.', 400)
    email = autorizacion.guardar_credenciales(flow.credentials)
    return _pagina(f'Listo: {autorizacion.para_que} {email or "esa cuenta"}. Podés cerrar esta pestaña.')
