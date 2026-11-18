"""El chat del equipo en Work (ADR-W171): el mismo de la Academia, que guarda los canales y los mensajes (su
docs/MODELO/CHAT.md y ADR-220). Work no guarda mensajes: le pasa a la Academia quién pregunta (por correo) y
devuelve lo que ella responde. Quien no tiene cuenta en la Academia (setters, marketing) escribe igual.

Primer paso: el canal General · Equipo y quién está conectado en Work, la Academia y Leadership.
El frontend consulta el canal cada 4 s (`desde` = el último id que tiene) y los conectados cada minuto.
"""
import logging

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app.models import User
from app.services.learnation_service import LearnationAPIError, LearnationService

bp = Blueprint('chat_api', __name__)
logger = logging.getLogger(__name__)

CANAL = 'equipo'
MAX_CARACTERES = 4000


def _quien():
    return {'email': current_user.email, 'nombre': current_user.username or current_user.email}


def _a_la_academia(accion, cuerpo):
    """(respuesta, estado); si la Academia no responde, un error corto para mostrar."""
    try:
        return LearnationService.chat(accion, {'quien': _quien(), **cuerpo}), 200
    except LearnationAPIError as e:
        logger.error(f"chat {accion}: {e}")
        return {'error': 'El chat de la Academia no responde. Probá en un rato.'}, e.status_code or 502


@bp.route('/canal', methods=['GET'])
@login_required
def canal():
    desde = request.args.get('desde', type=int) or 0
    datos, estado = _a_la_academia('canal', {'canal': CANAL, 'desde_id': desde})
    return jsonify(datos), estado


@bp.route('/enviar', methods=['POST'])
@login_required
def enviar():
    cuerpo = request.get_json(silent=True) or {}
    texto = str(cuerpo.get('texto') or '').strip()
    if not texto:
        return jsonify({'error': 'El mensaje está vacío.'}), 400
    if len(texto) > MAX_CARACTERES:
        return jsonify({'error': f'El mensaje pasa los {MAX_CARACTERES} caracteres.'}), 400
    pedido = {'canal': CANAL, 'texto': texto}
    if cuerpo.get('parent_id'):
        pedido['parent_id'] = int(cuerpo['parent_id'])
    datos, estado = _a_la_academia('enviar', pedido)
    return jsonify(datos), 201 if estado == 200 else estado


@bp.route('/conectados', methods=['GET'])
@login_required
def conectados():
    """Marca a quien pregunta como conectado en Work y devuelve a todos, con el rol de Work si es de acá."""
    datos, estado = _a_la_academia('conectados', {})
    if estado != 200:
        return jsonify(datos), estado
    gente = datos.get('conectados') or []
    correos = [p.get('email') for p in gente if p.get('email')]
    roles = dict(User.query.with_entities(User.email, User.role).filter(User.email.in_(correos)).all()) if correos else {}
    roles = {str(k).lower(): v for k, v in roles.items()}
    for p in gente:
        p['rol'] = roles.get(str(p.get('email')).lower())
        p['yo'] = str(p.get('email')).lower() == str(current_user.email).lower()
    return jsonify({'conectados': gente})
