"""Notas de Meet (app/services/notas_meet/): conectar el Drive de team@, su estado y las notas de un lead.

- /api/notas-meet/*: la configuración, solo admin.
- /google/notas/conectar/<firma>: el link firmado que abre quien tiene la cuenta de team@ (sin sesión de Work).
- Las notas de un lead se leen por la ficha (`GET /api/ficha/notas-meet`, app/api/ficha/lectura.py).
"""
import logging
import threading

from flask import Blueprint, current_app, jsonify, redirect, request, session
from flask_login import current_user

from app.decorators import admin_required
from app.services.google_service import GoogleService
from app.services.notas_meet import conexion, sincronizar

logger = logging.getLogger(__name__)

bp = Blueprint('notas_meet', __name__)


def _pagina(mensaje, codigo=200):
    html = ('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
            '<title>Notas de Meet</title><body style="font-family:sans-serif;text-align:center;padding:48px">'
            f'<p>{mensaje}</p></body>')
    return html, codigo, {'Content-Type': 'text/html; charset=utf-8'}


@bp.route('/api/notas-meet/estado', methods=['GET'])
@admin_required
def estado():
    return jsonify(conexion.estado()), 200


@bp.route('/api/notas-meet/link', methods=['POST'])
@admin_required
def link():
    return jsonify({'link': conexion.link_para_conectar(), 'vence_en_horas': conexion.VIGENCIA_LINK_S // 3600}), 200


@bp.route('/api/notas-meet/sincronizar', methods=['POST'])
@admin_required
def sincronizar_ahora():
    # En segundo plano: la primera lectura baja cientos de Docs y no entra en el tiempo de un request.
    completa = bool((request.get_json(silent=True) or {}).get('completa'))
    if not conexion.estado()['conectada']:
        return jsonify({'error': 'No hay ninguna cuenta conectada.'}), 409
    app = current_app._get_current_object()

    def correr():
        with app.app_context():
            try:
                logger.info(f'[NOTAS_MEET] Lectura manual: {sincronizar.sincronizar(completa=completa)}')
            except Exception as e:  # noqa: BLE001  (el detalle queda en ultimo_error y en el log)
                logger.error(f'[NOTAS_MEET] Falló la lectura manual: {e}')

    threading.Thread(target=correr, daemon=True).start()
    return jsonify({'en_curso': True}), 202


@bp.route('/api/notas-meet/desconectar', methods=['POST'])
@admin_required
def desconectar():
    conexion.desconectar()
    return jsonify({'ok': True}), 200


@bp.route('/google/notas/conectar/<firma>', methods=['GET'])
def conectar(firma):
    motivo = conexion.leer_firma(firma)
    if motivo:
        return _pagina(motivo, 400)
    redirect_uri = GoogleService.redirect_uri()
    flow = GoogleService.get_flow(redirect_uri, scopes=conexion.SCOPES)
    auth_url, state = flow.authorization_url(access_type='offline', prompt='consent')
    session['google_oauth_state'] = state
    session['google_redirect_uri'] = redirect_uri
    session.pop('google_oauth_proposito', None)
    session.pop('google_conectar', None)
    # Desde el botón «Conectar con Google» (sesión de Work abierta) se vuelve a Integraciones.
    session['google_notas'] = 'volver' if request.args.get('volver') and current_user.is_authenticated else True
    return redirect(auth_url)


VOLVER = '/ops/dashboard?step=integraciones'


def vuelta_de_google(state, redirect_uri, volver=False):
    """La vuelta de /google/callback cuando lo que se conectaba era el Drive de team@."""
    if request.args.get('error'):
        return _pagina('Se canceló la conexión. Podés volver a abrir el link para intentarlo de nuevo.')
    if not state or not redirect_uri or request.args.get('state') != state:
        return _pagina('No se pudo conectar: la sesión de Google no coincide. Volvé a abrir el link.', 400)
    try:
        flow = GoogleService.get_flow(redirect_uri, scopes=conexion.SCOPES)
        flow.fetch_token(authorization_response=request.url)
    except Exception as e:  # noqa: BLE001  (código vencido, permiso no otorgado, cliente mal configurado...)
        current_app.logger.warning(f'[NOTAS_MEET] No se pudo conectar el Drive: {e}')
        return _pagina('No se pudo conectar. Revisá que hayas aceptado el permiso de Drive y probá de nuevo.', 400)
    email = conexion.guardar_credenciales(flow.credentials)
    if volver:
        return redirect(VOLVER)
    return _pagina(f'Listo: Work ya lee las notas de Meet de {email or "esa cuenta"}. Podés cerrar esta pestaña.')
