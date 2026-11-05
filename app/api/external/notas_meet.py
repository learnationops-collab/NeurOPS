"""Las notas de Meet como servicio para la Academia: lo que Gemini dejó en el Drive conectado
(app/services/notas_meet/), consultado desde la Academia. Mismo token que la agenda (ACADEMY_INBOUND_API_TOKEN).

Work guarda las notas en `meeting_notes` y las trae cada 15 minutos: acá solo se leen. Para cruzarlas con
una sesión que la Academia agendó por /agenda, usar el `event_id` que devolvió la reserva. Contrato en
docs/agendas_v2_api.md («API de notas de Meet para la Academia»).
"""
import logging
import threading
from datetime import datetime, timedelta

from flask import current_app, jsonify, request
from sqlalchemy import String, cast, or_

from app.api.external import bp
from app.api.google_calendar import _RUTA_INTERNA
from app.decorators import require_academy_token
from app.models import MeetingNote
from app.services.notas_meet import categorias, conexion, series, sincronizar

logger = logging.getLogger(__name__)

LIMITE_MAX = 100


def _fecha(texto):
    """'YYYY-MM-DD' (o ISO con hora) a datetime UTC naive; None si no vino. ValueError si no se entiende."""
    if not texto:
        return None
    return datetime.fromisoformat(texto.replace('Z', '+00:00')).replace(tzinfo=None)


@bp.route('/notas/estado', methods=['GET'])
@require_academy_token
def notas_estado():
    e = conexion.estado()
    return jsonify(e), 200


@bp.route('/notas/conectar', methods=['POST'])
@require_academy_token
def notas_conectar():
    """`{volver}`: ruta de la Academia. Devuelve la URL que abre quien tiene la cuenta (vence en 24 h, una
    vez). Al terminar vuelve a ACADEMY_URL + volver?notas=ok|cancelado|error."""
    volver = (request.get_json(silent=True) or {}).get('volver') or '/'
    if not _RUTA_INTERNA.match(volver):
        return jsonify({'error': 'volver tiene que ser una ruta de la Academia (/...)'}), 400
    return jsonify({'url': conexion.link_para_conectar(academia=volver)}), 200


@bp.route('/notas/sincronizar', methods=['POST'])
@require_academy_token
def notas_sincronizar():
    """Trae las notas nuevas sin esperar los 15 minutos. Corre en segundo plano: responde 202 al toque."""
    if not conexion.estado()['conectada']:
        return jsonify({'error': 'no_conectada'}), 409
    app = current_app._get_current_object()

    def correr():
        with app.app_context():
            try:
                logger.info(f'[NOTAS_MEET] Lectura pedida por la Academia: {sincronizar.sincronizar()}')
            except Exception as e:  # noqa: BLE001  (queda en ultimo_error y en el log)
                logger.error(f'[NOTAS_MEET] Falló la lectura pedida por la Academia: {e}')

    threading.Thread(target=correr, daemon=True).start()
    return jsonify({'en_curso': True}), 202


@bp.route('/notas', methods=['GET'])
@require_academy_token
def notas_listar():
    """Filtros (todos opcionales y combinables): `event_id` (el de la reserva), `email` (invitado),
    `q` (en el título), `tipo` (el `kind`: lo que va antes de «:» en el título del evento), `categoria`
    (sales|student|team|interview|other), `serie`, `cuenta` (de qué Drive salió), `desde`/`hasta`
    (fecha de la reunión), `limite`, `offset`.
    Sin el contenido completo: ese va en GET /notas/<id>."""
    a = request.args
    try:
        desde, hasta = _fecha(a.get('desde')), _fecha(a.get('hasta'))
        limite = min(max(int(a.get('limite', 50)), 1), LIMITE_MAX)
        offset = max(int(a.get('offset', 0)), 0)
    except ValueError:
        return jsonify({'error': 'desde/hasta son fechas ISO; limite/offset, números'}), 400

    consulta = MeetingNote.query
    if a.get('event_id'):
        consulta = consulta.filter(MeetingNote.calendar_event_id == a['event_id'].strip())
    if a.get('email'):
        consulta = consulta.filter(cast(MeetingNote.guests, String).ilike(f"%{a['email'].strip().lower()}%"))
    if a.get('q'):
        consulta = consulta.filter(MeetingNote.title.ilike(f"%{a['q'].strip()}%"))
    if a.get('tipo'):
        consulta = consulta.filter(MeetingNote.kind == a['tipo'])
    if a.get('categoria'):
        consulta = consulta.filter(MeetingNote.category == a['categoria'])
    if a.get('serie'):
        consulta = consulta.filter(MeetingNote.series == a['serie'])
    if a.get('cuenta'):
        consulta = consulta.filter(MeetingNote.account_email == a['cuenta'].strip().lower())
    if desde:
        consulta = consulta.filter(MeetingNote.meeting_at >= desde)
    if hasta:
        # Una fecha sola incluye ese día entero.
        consulta = consulta.filter(MeetingNote.meeting_at < (hasta + timedelta(days=1) if len(a['hasta']) == 10 else hasta))
    total = consulta.count()
    notas = (consulta.order_by(MeetingNote.meeting_at.desc().nullslast(), MeetingNote.id.desc())
             .offset(offset).limit(limite).all())
    return jsonify({'total': total, 'notas': [n.to_dict() for n in notas]}), 200


@bp.route('/notas/series', methods=['GET'])
@require_academy_token
def notas_series():
    return jsonify({'series': series.listar(), 'categorias': categorias.CATEGORIAS}), 200


@bp.route('/notas/series', methods=['PUT'])
@require_academy_token
def notas_elegir_serie():
    """`{serie, categoria}`: la categoría de todas las notas de la serie (también las que vengan). null la
    devuelve a la automática."""
    d = request.get_json(silent=True) or {}
    try:
        cambiadas = series.elegir(d.get('serie'), d.get('categoria'))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify({'ok': True, 'cambiadas': cambiadas}), 200


@bp.route('/notas/<int:nota_id>', methods=['PATCH'])
@require_academy_token
def notas_elegir_categoria(nota_id):
    """`{categoria}` para esta nota sola (le gana a la de su serie); null la devuelve a la automática."""
    nota = MeetingNote.query.get(nota_id)
    if not nota:
        return jsonify({'error': 'no_existe'}), 404
    try:
        series.elegir_nota(nota, (request.get_json(silent=True) or {}).get('categoria'))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(nota.to_dict()), 200


@bp.route('/notas/<int:nota_id>', methods=['GET'])
@require_academy_token
def notas_una(nota_id):
    nota = MeetingNote.query.get(nota_id)
    if not nota:
        return jsonify({'error': 'no_existe'}), 404
    return jsonify(nota.to_dict(con_contenido=True)), 200
