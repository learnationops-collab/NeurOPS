"""Conectar la cuenta de Gmail que manda los mails de la plataforma (app/services/correo.py, ADR-W123).

GET /google/correo/conectar/<firma>: el link firmado lleva a Google pidiendo solo `gmail.send`; la vuelta entra
por /google/callback (app/api/google_calendar.py) y termina en `vuelta_de_google`.
"""
from flask import Blueprint, current_app, redirect, request, session

from app.services import correo
from app.services.google_service import GoogleService

bp = Blueprint('correo', __name__)


def _pagina(mensaje, codigo=200):
    html = ('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
            '<title>Correo de la plataforma</title><body style="font-family:sans-serif;text-align:center;padding:48px">'
            f'<p>{mensaje}</p></body>')
    return html, codigo, {'Content-Type': 'text/html; charset=utf-8'}


@bp.route('/google/correo/conectar/<firma>', methods=['GET'])
def conectar(firma):
    motivo = correo.leer_firma(firma)
    if motivo:
        return _pagina(motivo, 400)
    redirect_uri = GoogleService.redirect_uri()
    flow = GoogleService.get_flow(redirect_uri, scopes=correo.SCOPES)
    # Sin include_granted_scopes: una autorización aparte, que no suma ni toca las de Calendar o Drive.
    auth_url, state = flow.authorization_url(access_type='offline', prompt='consent select_account')
    session['google_oauth_state'] = state
    session['google_redirect_uri'] = redirect_uri
    for clave in ('google_oauth_proposito', 'google_conectar', 'google_notas'):
        session.pop(clave, None)
    session['google_correo'] = True
    return redirect(auth_url)


def vuelta_de_google(state, redirect_uri):
    if request.args.get('error'):
        return _pagina('Se canceló la conexión. Podés volver a abrir el link para intentarlo de nuevo.')
    if not state or not redirect_uri or request.args.get('state') != state:
        return _pagina('No se pudo conectar: la sesión de Google no coincide. Volvé a abrir el link.', 400)
    try:
        flow = GoogleService.get_flow(redirect_uri, scopes=correo.SCOPES)
        flow.fetch_token(authorization_response=request.url)
    except Exception as e:  # noqa: BLE001  (código vencido, permiso no otorgado, Gmail API apagada...)
        current_app.logger.warning(f'[CORREO] No se pudo conectar Gmail: {e}')
        return _pagina('No se pudo conectar. Revisá que hayas aceptado el permiso de enviar correos y probá de nuevo.', 400)
    email = correo.guardar_credenciales(flow.credentials)
    return _pagina(f'Listo: los mails de la plataforma salen desde {email or "esa cuenta"}. Podés cerrar esta pestaña.')
