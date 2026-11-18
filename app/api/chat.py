"""El chat del equipo en Work (ADR-W171): el mismo de la Academia, que guarda los canales y los mensajes (su
docs/MODELO/CHAT.md y ADR-220). Work no guarda mensajes: le pasa a la Academia quién pregunta (por correo) y
devuelve lo que ella responde. Quien no tiene cuenta en la Academia (setters, marketing) escribe igual.

Primer paso: el canal General · Equipo y quién está conectado en Work, la Academia y Leadership.
El frontend consulta el canal cada 4 s (`desde` = el último id que tiene) y los conectados cada minuto.
"""
import logging

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.models import User
from app.services import avisos_service
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
    """Los mensajes nuevos desde `desde`, o con `buscar` (2 letras o más) los 50 más recientes que lo tienen."""
    pedido = {'canal': CANAL, 'desde_id': request.args.get('desde', type=int) or 0}
    buscar = (request.args.get('buscar') or '').strip()[:80]
    if len(buscar) >= 2:
        pedido['buscar'] = buscar
    datos, estado = _a_la_academia('canal', pedido)
    return jsonify(datos), estado


@bp.route('/enviar', methods=['POST'])
@login_required
def enviar():
    """Un mensaje: {texto, parent_id?, menciones?: [email], como?: 'learnito'}. `como: learnito` comparte en el canal
    una respuesta de Learnito que pidió quien manda (la firma Learnito)."""
    cuerpo = request.get_json(silent=True) or {}
    texto = str(cuerpo.get('texto') or '').strip()
    como = 'learnito' if cuerpo.get('como') == 'learnito' else None
    tope = MAX_CARACTERES * 2 if como else MAX_CARACTERES
    if not texto:
        return jsonify({'error': 'El mensaje está vacío.'}), 400
    if len(texto) > tope:
        return jsonify({'error': f'El mensaje pasa los {tope} caracteres.'}), 400
    menciones = [str(e).strip().lower() for e in (cuerpo.get('menciones') or []) if '@' in str(e)][:10]
    pedido = {'canal': CANAL, 'texto': texto, 'menciones': menciones or None, 'como': como}
    if cuerpo.get('parent_id'):
        pedido['parent_id'] = int(cuerpo['parent_id'])
    datos, estado = _a_la_academia('enviar', {k: v for k, v in pedido.items() if v is not None})
    if estado == 200 and menciones and not como:
        _avisar_menciones(menciones, texto)
    return jsonify(datos), 201 if estado == 200 else estado


def _avisar_menciones(correos, texto):
    """A la gente de Work etiquetada con @, el aviso en la campanita (la Academia avisa a la suya)."""
    try:
        quien = current_user.username or current_user.email
        etiquetados = User.query.filter(User.email.in_(correos), User.is_active.is_(True),
                                        User.id != current_user.id).all()
        for u in etiquetados:
            avisos_service.avisar('chat_mencion', 'user', u.id, f'{quien} te etiquetó en Equipo', texto[:300],
                                  origen='chat', payload={'abrir': 'chat'})
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"chat menciones: {e}")


@bp.route('/reaccion', methods=['POST'])
@login_required
def reaccion():
    """Pone o saca una reacción: {id, clave} (las de la Academia: fire, heart, thumb, check, bolt, smile)."""
    cuerpo = request.get_json(silent=True) or {}
    if not str(cuerpo.get('id') or '').isdigit() or not cuerpo.get('clave'):
        return jsonify({'error': 'Falta el mensaje o la reacción.'}), 400
    datos, estado = _a_la_academia('reaccion', {'id': int(cuerpo['id']), 'clave': str(cuerpo['clave'])})
    return jsonify(datos), estado


@bp.route('/personas', methods=['GET'])
@login_required
def personas():
    """A quién se puede etiquetar: el equipo de la Academia y la gente activa de Work, sin repetir el correo."""
    datos, estado = _a_la_academia('personas', {})
    gente = {p['email']: p for p in (datos.get('personas') or []) if p.get('email')} if estado == 200 else {}
    for u in User.query.filter(User.is_active.is_(True), User.email.isnot(None)).all():
        correo = u.email.lower()
        if correo != current_user.email.lower():
            gente.setdefault(correo, {'nombre': u.username or correo, 'email': correo, 'foto': None})
    gente.pop(current_user.email.lower(), None)
    return jsonify({'personas': sorted(gente.values(), key=lambda p: p['nombre'].lower())})


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
