"""El chat del equipo en Work (ADR-W171, W175): el mismo de la Academia, que guarda los canales y los mensajes (su
docs/MODELO/CHAT.md, ADR-220 y ADR-224). Work no guarda mensajes: le pasa a la Academia quién pregunta (por correo)
y devuelve lo que ella responde. Quien no tiene cuenta del equipo en la Academia (setters, triage, marketing)
recibe una solo para el chat la primera vez que aparece.

Conversaciones: General · Equipo (ventas no ve los canales de un área) y las directas con alguien del equipo
(`con` = su correo). El frontend consulta la conversación abierta cada 4 s (`desde` = el último id que tiene),
y los conectados y la bandeja (lo no leído) cada 30 s.
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
        if e.status_code == 404:
            return {'error': 'Esa conversación no está disponible.'}, 404
        return {'error': 'El chat de la Academia no responde. Probá en un rato.'}, e.status_code or 502


def _donde(valor):
    """La conversación: {'con': correo, 'con_nombre'} para una directa, o General · Equipo."""
    correo = str(valor or '').strip().lower()
    if '@' not in correo or correo == str(current_user.email).lower():
        return {'canal': CANAL}
    persona = User.query.filter(db.func.lower(User.email) == correo).first()
    return {'con': correo, 'con_nombre': (persona.username if persona else None) or correo.split('@')[0]}


@bp.route('/canal', methods=['GET'])
@login_required
def canal():
    """Los mensajes nuevos desde `desde`, o con `buscar` (2 letras o más) los 50 más recientes que lo tienen.
    Con `con` (un correo), la conversación directa con esa persona."""
    pedido = {**_donde(request.args.get('con')), 'desde_id': request.args.get('desde', type=int) or 0}
    buscar = (request.args.get('buscar') or '').strip()[:80]
    if len(buscar) >= 2:
        pedido['buscar'] = buscar
    datos, estado = _a_la_academia('canal', pedido)
    return jsonify(datos), estado


@bp.route('/bandeja', methods=['GET'])
@login_required
def bandeja():
    """Lo no leído de Equipo y las conversaciones directas, la más reciente arriba."""
    datos, estado = _a_la_academia('bandeja', {})
    return jsonify(datos), estado


@bp.route('/enviar', methods=['POST'])
@login_required
def enviar():
    """Un mensaje: {texto, con?, parent_id?, menciones?: [email], como?: 'learnito'}. `con` (un correo) lo manda a
    la conversación directa con esa persona. `como: learnito` comparte una respuesta de Learnito que pidió quien
    manda (la firma Learnito). Las etiquetas avisan solo en Equipo."""
    cuerpo = request.get_json(silent=True) or {}
    texto = str(cuerpo.get('texto') or '').strip()
    como = 'learnito' if cuerpo.get('como') == 'learnito' else None
    tope = MAX_CARACTERES * 2 if como else MAX_CARACTERES
    if not texto:
        return jsonify({'error': 'El mensaje está vacío.'}), 400
    if len(texto) > tope:
        return jsonify({'error': f'El mensaje pasa los {tope} caracteres.'}), 400
    menciones = [str(e).strip().lower() for e in (cuerpo.get('menciones') or []) if '@' in str(e)][:10]
    donde = _donde(cuerpo.get('con'))
    if 'con' in donde:
        menciones = []
    pedido = {**donde, 'texto': texto, 'menciones': menciones or None, 'como': como}
    if str(cuerpo.get('parent_id') or '').isdigit():
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
    """Marca a quien pregunta como conectado en Work y devuelve a todos, con el rol de Work si es de acá y lo que
    está haciendo (ADR-W176): «En llamada» si tiene una agenda en curso en Work, o lo que diga su agenda de la
    Academia (en sesión, en clase, en reunión). También los desconectados de los últimos 30 días, con cuándo se
    los vio. Le pasa a la Academia el «En llamada» de quien pregunta (o nada), así lo ven también la Academia y
    Leadership (Academia ADR-226)."""
    mio = _en_llamada([current_user.id]).get(current_user.id)
    datos, estado = _a_la_academia('conectados', {'estado': mio})
    if estado != 200:
        return jsonify(datos), estado
    gente = datos.get('conectados') or []
    fuera = datos.get('desconectados') or []
    correos = [str(p.get('email')).lower() for p in gente + fuera if p.get('email')]
    usuarios = User.query.filter(db.func.lower(User.email).in_(correos)).all() if correos else []
    por_correo = {u.email.lower(): u for u in usuarios}
    en_linea = {str(p.get('email')).lower() for p in gente}
    llamadas = _en_llamada([u.id for u in usuarios if u.email.lower() in en_linea])
    yo = str(current_user.email).lower()
    for p in gente + fuera:
        u = por_correo.get(str(p.get('email')).lower())
        p['rol'] = u.role if u else None
        p['yo'] = str(p.get('email')).lower() == yo
        p['baja'] = bool(u and not u.is_active)
        if u and u.id in llamadas:
            p['estado'] = llamadas[u.id]
    # Los dados de baja en Work no aparecen como desconectados.
    fuera = [p for p in fuera if not p['yo'] and not p['baja']]
    return jsonify({'conectados': gente, 'desconectados': fuera})


def _en_llamada(ids):
    """{user_id: {texto, hasta}} de quienes tienen ahora una agenda en curso como closer (empezó y no terminó su
    duración, sin cancelar ni reprogramar)."""
    if not ids:
        return {}
    from datetime import datetime, timedelta

    from app.agendas_v2.operacion import RESULTADOS_NO_VIGENTES
    from app.models.booking import Appointment

    ahora = datetime.utcnow()
    try:
        agendas = Appointment.query.filter(
            Appointment.closer_id.in_(ids), Appointment.start_time <= ahora,
            Appointment.start_time >= ahora - timedelta(hours=3),
            db.or_(Appointment.result.is_(None), Appointment.result.notin_(RESULTADOS_NO_VIGENTES)),
        ).all()
    except Exception as e:
        logger.error(f"chat en llamada: {e}")
        return {}
    salida = {}
    for a in agendas:
        payload = a.agenda_payload if isinstance(a.agenda_payload, dict) else {}
        fin = a.start_time + timedelta(minutes=int(payload.get('duracion_min') or 60))
        if fin > ahora and (a.closer_id not in salida or salida[a.closer_id]['hasta'] < fin.isoformat() + 'Z'):
            salida[a.closer_id] = {'texto': 'En llamada', 'hasta': fin.isoformat() + 'Z'}
    return salida
