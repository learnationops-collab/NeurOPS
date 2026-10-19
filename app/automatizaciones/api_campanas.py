"""API de campañas del Inbox (/api/inbox/campanas): se cuelga del blueprint de `api.py`, con su guardia."""
from datetime import date, datetime, timedelta, timezone

from flask import jsonify, request

from app import db
from app.automatizaciones import campanas, metricas_campanas, servicio
from app.automatizaciones.api import bp
from app.automatizaciones.modelos import AutCampana, AutEjecucion
from app.models import ConversationalMessage, MetaAnuncio

DIAS_POR_DEFECTO = 30
PERIODO_MAXIMO = 400


def _fecha(valor):
    """ISO (con o sin hora, con Z u offset) a UTC naive; None si viene vacío. ValueError si no se entiende."""
    if valor in (None, ''):
        return None
    fecha = datetime.fromisoformat(str(valor).replace('Z', '+00:00'))
    if fecha.tzinfo:
        fecha = fecha.astimezone(timezone.utc).replace(tzinfo=None)
    return fecha


def _datos():
    datos = request.get_json(silent=True)
    datos = dict(datos) if isinstance(datos, dict) else {}
    for campo in ('desde', 'hasta'):
        if campo in datos:
            datos[campo] = _fecha(datos[campo])
    return datos


def _guardar(campana):
    try:
        campanas.guardar(campana, _datos())
    except ValueError as error:  # ErrorDeCampana o una fecha mal escrita
        db.session.rollback()
        return jsonify({'message': str(error)}), 400
    db.session.add(campana)
    db.session.commit()
    return None


def _periodo():
    """(desde, hasta) de `?desde=&hasta=` (fechas); por defecto los últimos DIAS_POR_DEFECTO días."""
    hoy = servicio.ahora().date()
    try:
        hasta = date.fromisoformat(request.args['hasta']) if request.args.get('hasta') else hoy
        desde = date.fromisoformat(request.args['desde']) if request.args.get('desde') \
            else hasta - timedelta(days=DIAS_POR_DEFECTO - 1)
    except ValueError:
        return None
    return (desde, hasta) if desde <= hasta and (hasta - desde).days <= PERIODO_MAXIMO else None


@bp.route('/campanas', methods=['GET'])
def listar_campanas():
    """Las campañas con sus métricas del período (`metricas_campanas`)."""
    periodo = _periodo()
    if periodo is None:
        return jsonify({'message': 'Período inválido'}), 400
    ahora = servicio.ahora()
    todas = AutCampana.query.order_by(AutCampana.desde.desc(), AutCampana.id.desc()).all()
    metricas = metricas_campanas.de_campanas(*periodo, ahora)
    return jsonify({
        'desde': periodo[0].isoformat(), 'hasta': periodo[1].isoformat(),
        'campanas': [{**campanas.resumen(c, ahora), 'metricas': metricas.get(c.id)} for c in todas],
    })


@bp.route('/catalogo', methods=['GET'])
def catalogo_de_mensajes():
    """Los mensajes del catálogo de Conversaciones: lo que un paso del flujo registra para Marketing."""
    mensajes = ConversationalMessage.query.order_by(ConversationalMessage.message_id).all()
    return jsonify({'mensajes': [{'id': m.message_id, 'titulo': m.title, 'categoria': m.category, 'rama': m.rama,
                                  'activo': bool(m.is_active)} for m in mensajes]})


@bp.route('/campanas', methods=['POST'])
def crear_campana():
    campana = AutCampana()
    error = _guardar(campana)
    if error:
        return error
    return jsonify(campanas.resumen(campana, servicio.ahora())), 201


@bp.route('/campanas/<int:campana_id>', methods=['PUT'])
def editar_campana(campana_id):
    campana = db.session.get(AutCampana, campana_id)
    if campana is None:
        return jsonify({'message': 'Not found'}), 404
    error = _guardar(campana)
    if error:
        return error
    return jsonify(campanas.resumen(campana, servicio.ahora()))


@bp.route('/campanas/<int:campana_id>', methods=['DELETE'])
def borrar_campana(campana_id):
    """Solo si nadie entró por ella: la que ya trajo gente deja historia; se termina con `hasta`."""
    campana = db.session.get(AutCampana, campana_id)
    if campana is None:
        return jsonify({'message': 'Not found'}), 404
    if AutEjecucion.query.filter_by(campana_id=campana.id).first():
        return jsonify({'message': 'Ya entró gente por esta campaña: ponele fecha de fin'}), 409
    db.session.delete(campana)
    db.session.commit()
    return '', 204


@bp.route('/campanas/meta', methods=['GET'])
def campanas_de_meta():
    """Las campañas de Meta sincronizadas, para asociarlas: id, nombre, embudo y si tiene algo activo."""
    filas = (db.session.query(MetaAnuncio.campana_id, MetaAnuncio.campana, MetaAnuncio.embudo, MetaAnuncio.estado)
             .filter(MetaAnuncio.campana_id.isnot(None)).all())
    por_id = {}
    for campana_id, nombre, embudo, estado in filas:
        c = por_id.setdefault(campana_id, {'id': campana_id, 'nombre': nombre, 'embudos': set(), 'activa': False})
        c['embudos'].add(embudo)
        c['activa'] = c['activa'] or estado == 'ACTIVE'
    salida = [{**c, 'embudos': sorted(e for e in c['embudos'] if e)} for c in por_id.values()]
    salida.sort(key=lambda c: (not c['activa'], (c['nombre'] or '').lower()))
    return jsonify({'campanas': salida})
