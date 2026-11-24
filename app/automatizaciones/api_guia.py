"""La Guía del setting en /api/inbox/guia (ADR-W197), colgada del blueprint del Inbox.

El setter lee, publica los pasos y propone lo demás (`ACCIONES_DEL_SETTER`). Admin, operador y dirección
comercial además cambian «Quién es lead» y los seguimientos automáticos, vuelven a una versión anterior y
responden las propuestas. Hay una guía por embudo (ADR-W204): `?embudo=<slug>`; sin él, Conversión.
"""
from flask import jsonify, request
from flask_login import current_user

from app import db
from app.automatizaciones import embudos, fases, guia
from app.automatizaciones.api import ROLES_CON_ACCESO, _cuerpo, _iso, bp
from app.automatizaciones.modelos import AutEmbudo, GuiaPropuesta, GuiaVersion, ahora


def _puede_aprobar():
    return current_user.role in ROLES_CON_ACCESO


def _embudo():
    return embudos.por_slug(request.args.get('embudo'))


def _version(v):
    if v is None:
        return {'id': None, 'en': None, 'por': None, 'nota': 'La estructura del documento de setting'}
    return {'id': v.id, 'en': _iso(v.creada_en), 'por': v.autor.username if v.autor else None, 'nota': v.nota}


def _propuesta(p):
    return {'id': p.id, 'etapa': p.etapa, 'texto': p.texto, 'estado': p.estado, 'respuesta': p.respuesta,
            'por': p.autor.username if p.autor else None, 'en': _iso(p.creada_en),
            'revisor': p.revisor.username if p.revisor else None, 'revisada_en': _iso(p.revisada_en)}


@bp.route('/guia', methods=['GET'])
def ver_guia():
    embudo = _embudo()
    if embudo is None:
        return jsonify({'message': 'Not found'}), 404
    from app.automatizaciones import cadencias  # importa el motor (por `escribir`): solo cuando se usa
    v, contenido = guia.vigente(embudo)
    pendientes = GuiaPropuesta.query.filter_by(estado=GuiaPropuesta.PENDIENTE).count()
    nombres = {f['id']: f['nombre'] for f in embudos.fases_de(embudo)}
    return jsonify({'version': _version(v), 'contenido': contenido, 'uso': guia.uso(), 'dias_uso': guia.DIAS_USO,
                    'puede_aprobar': _puede_aprobar(), 'propuestas_pendientes': pendientes,
                    'embudo': embudos.resumen(embudo), 'seguimientos_uso': cadencias.metricas(embudo),
                    'fases': [{'id': f, 'nombre': nombres.get(f) or fases.NOMBRES.get(f, f)} for f in embudos.ids_de(embudo)]})


@bp.route('/guia', methods=['PUT'])
def publicar_guia():
    """`{contenido, base, nota}`: `base` es el id de la versión que se editó; si otro publicó antes, 409."""
    datos = _cuerpo()
    embudo = _embudo()
    if embudo is None:
        return jsonify({'message': 'Not found'}), 404
    actual, _ = guia.vigente(embudo)
    if (actual.id if actual else None) != datos.get('base'):
        return jsonify({'message': 'Alguien publicó la guía mientras la editabas: recargá para ver su versión'}), 409
    try:
        v = guia.publicar(datos.get('contenido'), current_user.id, _puede_aprobar(), datos.get('nota'), embudo)
    except guia.GuiaInvalida as e:
        return jsonify({'message': str(e)}), 400
    except PermissionError as e:
        return jsonify({'message': str(e)}), 403
    return jsonify({'version': _version(v), 'contenido': v.contenido})


@bp.route('/guia/historial', methods=['GET'])
def historial_guia():
    guardado = embudos.id_guardado(_embudo())
    filtro = GuiaVersion.embudo_id.is_(None) if guardado is None else GuiaVersion.embudo_id == guardado
    vs = GuiaVersion.query.filter(filtro).order_by(GuiaVersion.id.desc()).limit(50).all()
    return jsonify({'versiones': [_version(v) for v in vs]})


@bp.route('/guia/versiones/<int:vid>/restaurar', methods=['POST'])
def restaurar_guia(vid):
    """Publica otra vez una versión anterior (como versión nueva, así queda en el historial)."""
    vieja = db.session.get(GuiaVersion, vid)
    if vieja is None:
        return jsonify({'message': 'Not found'}), 404
    embudo = db.session.get(AutEmbudo, vieja.embudo_id) if vieja.embudo_id else None
    try:
        v = guia.publicar(vieja.contenido, current_user.id, True, f'Vuelta a la versión del {vieja.creada_en:%d/%m %H:%M}',
                          embudo)
    except guia.GuiaInvalida as e:
        return jsonify({'message': str(e)}), 400
    return jsonify({'version': _version(v), 'contenido': v.contenido})


@bp.route('/guia/propuestas', methods=['GET'])
def propuestas_guia():
    ps = GuiaPropuesta.query.order_by(GuiaPropuesta.id.desc()).limit(50).all()
    return jsonify({'propuestas': [_propuesta(p) for p in ps]})


@bp.route('/guia/propuestas', methods=['POST'])
def proponer_guia():
    datos = _cuerpo()
    texto = str(datos.get('texto') or '').strip()
    if not texto:
        return jsonify({'message': 'Escribí qué querés cambiar y por qué'}), 400
    etapa = str(datos.get('etapa') or '')[:20] or None
    p = GuiaPropuesta(texto=texto[:3000], etapa=etapa, autor_id=current_user.id)
    db.session.add(p)
    db.session.commit()
    return jsonify(_propuesta(p)), 201


@bp.route('/guia/propuestas/<int:pid>', methods=['PUT'])
def responder_propuesta_guia(pid):
    """`{estado: aprobada|rechazada, respuesta}`. Aprobarla no cambia la guía sola: el cambio lo hace quien aprueba."""
    p = db.session.get(GuiaPropuesta, pid)
    if p is None:
        return jsonify({'message': 'Not found'}), 404
    datos = _cuerpo()
    if datos.get('estado') not in (GuiaPropuesta.APROBADA, GuiaPropuesta.RECHAZADA):
        return jsonify({'message': 'Estado inválido'}), 400
    respuesta = str(datos.get('respuesta') or '').strip()
    if datos['estado'] == GuiaPropuesta.RECHAZADA and not respuesta:
        return jsonify({'message': 'Contale por qué la rechazás'}), 400
    p.estado, p.respuesta = datos['estado'], respuesta[:2000] or None
    p.revisor_id, p.revisada_en = current_user.id, ahora()
    db.session.commit()
    return jsonify(_propuesta(p))
