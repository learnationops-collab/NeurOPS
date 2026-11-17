"""Propuestas de cambios de estructura de un flujo (ADR-W147, Estrategia 16/11/2026), colgadas del blueprint
del Inbox. El setter propone a partir de la versión publicada; admin, operador y dirección comercial
(`ROLES_CON_ACCESO`) aprueban (se publica) o rechazan. Los textos siguen sin aprobación (`api_mensajes.py`)
y la dirección comercial publica directo desde el lienzo."""
from flask import jsonify, request
from flask_login import current_user

from app import db
from app.automatizaciones import servicio
from app.automatizaciones.api import ROLES_CON_ACCESO, _error_de_grafo, _flujo_completo, _iso, bp
from app.automatizaciones.modelos import AutFlujo, AutFlujoVersion, AutPropuesta, ahora
from app.automatizaciones.nucleo import grafo as g

LARGO_NOTA = 1000


def _revisa():
    return current_user.role in ROLES_CON_ACCESO


def _resumen(p):
    base = p.version_base
    publicada = p.flujo.version_publicada if p.flujo else None
    return {
        'id': p.id, 'flujo_id': p.flujo_id, 'flujo': p.flujo.nombre if p.flujo else None, 'estado': p.estado,
        'nota': p.nota, 'autor': p.autor.username if p.autor else None, 'creada_en': _iso(p.creada_en),
        'version_base': base.numero if base else None,
        # Se publicó otra versión después de proponerla: aprobarla pisaría ese cambio.
        'desactualizada': bool(publicada and p.version_base_id != publicada.id),
        'revisor': p.revisor.username if p.revisor else None, 'respuesta': p.respuesta,
        'revisada_en': _iso(p.revisada_en), 'version_numero': p.version_numero,
    }


def _propuesta_o_404(propuesta_id):
    p = db.session.get(AutPropuesta, propuesta_id)
    if p is None or (not _revisa() and p.autor_id != current_user.id):
        return None, (jsonify({'message': 'Not found'}), 404)
    return p, None


@bp.route('/flujos/<int:flujo_id>/para-proponer', methods=['GET'])
def flujo_para_proponer(flujo_id):
    """Lo que abre el lienzo del setter: la versión publicada (no el borrador de la dirección)."""
    flujo = db.session.get(AutFlujo, flujo_id)
    if flujo is None or flujo.version_publicada is None:
        return jsonify({'message': 'El flujo todavía no se publicó'}), 409
    grafo = flujo.version_publicada.grafo
    return jsonify({**_flujo_completo(flujo), 'grafo': grafo, 'errores': g.validar(grafo),
                    'version_base_id': flujo.version_publicada_id})


@bp.route('/flujos/<int:flujo_id>/propuestas', methods=['POST'])
def proponer_cambios(flujo_id):
    flujo = db.session.get(AutFlujo, flujo_id)
    if flujo is None or flujo.version_publicada is None:
        return jsonify({'message': 'El flujo todavía no se publicó'}), 409
    datos = request.get_json(silent=True) or {}
    grafo = datos.get('grafo')
    problema = _error_de_grafo(grafo)
    if problema:
        return jsonify({'message': problema}), 400
    errores = g.validar(grafo)
    if errores:
        return jsonify({'message': 'El flujo tiene errores', 'errores': errores}), 422
    nota = str(datos.get('nota') or '').strip()[:LARGO_NOTA]
    if not nota:
        return jsonify({'message': 'Contá qué cambiaste y por qué'}), 400
    p = AutPropuesta(flujo_id=flujo.id, version_base_id=flujo.version_publicada_id, grafo=grafo, nota=nota,
                     autor_id=current_user.id)
    db.session.add(p)
    db.session.commit()
    return jsonify(_resumen(p)), 201


@bp.route('/propuestas', methods=['GET'])
def listar_propuestas():
    """Pendientes para quien revisa; el setter ve las suyas (todas, con su respuesta)."""
    q = AutPropuesta.query
    if _revisa():
        q = q.filter(AutPropuesta.estado == AutPropuesta.PENDIENTE)
    else:
        q = q.filter(AutPropuesta.autor_id == current_user.id)
    return jsonify({'propuestas': [_resumen(p) for p in q.order_by(AutPropuesta.id.desc()).limit(50)],
                    'puede_revisar': _revisa()})


@bp.route('/propuestas/<int:propuesta_id>', methods=['GET'])
def ver_propuesta(propuesta_id):
    """La propuesta para abrirla en el lienzo, con el flujo como lo espera el editor."""
    p, error = _propuesta_o_404(propuesta_id)
    if error:
        return error
    return jsonify({'propuesta': _resumen(p),
                    'flujo': {**_flujo_completo(p.flujo), 'grafo': p.grafo, 'errores': g.validar(p.grafo)}})


def _revisar(propuesta_id):
    if not _revisa():
        return None, (jsonify({'message': 'Solo admin, operador o dirección comercial'}), 403)
    p = db.session.get(AutPropuesta, propuesta_id)
    if p is None:
        return None, (jsonify({'message': 'Not found'}), 404)
    if p.estado != AutPropuesta.PENDIENTE:
        return None, (jsonify({'message': 'Esa propuesta ya se revisó'}), 409)
    return p, None


@bp.route('/propuestas/<int:propuesta_id>/aprobar', methods=['POST'])
def aprobar_propuesta(propuesta_id):
    """Publica la propuesta sin tocar el estado del flujo. El borrador pasa a la propuesta solo si no
    tenía cambios propios (era igual a lo publicado): si los tenía, quedan para que la dirección los vea."""
    p, error = _revisar(propuesta_id)
    if error:
        return error
    flujo = p.flujo
    publicada = flujo.version_publicada
    if publicada and publicada.id != p.version_base_id:
        return jsonify({'message': 'Se publicó otra versión después de esta propuesta: rechazala y pedí que la rehagan '
                                   'sobre la versión actual'}), 409
    if publicada and flujo.grafo == publicada.grafo:
        flujo.grafo = p.grafo
    p.estado, p.revisor_id, p.revisada_en = AutPropuesta.APROBADA, current_user.id, ahora()
    p.respuesta = str((request.get_json(silent=True) or {}).get('respuesta') or '').strip()[:LARGO_NOTA] or None
    errores = servicio.publicar(flujo, grafo=p.grafo, activar=False)
    if errores:
        db.session.rollback()
        return jsonify({'message': 'El flujo tiene errores', 'errores': errores}), 422
    p.version_numero = db.session.get(AutFlujoVersion, flujo.version_publicada_id).numero
    db.session.commit()
    return jsonify(_resumen(p))


@bp.route('/propuestas/<int:propuesta_id>/rechazar', methods=['POST'])
def rechazar_propuesta(propuesta_id):
    p, error = _revisar(propuesta_id)
    if error:
        return error
    respuesta = str((request.get_json(silent=True) or {}).get('respuesta') or '').strip()[:LARGO_NOTA]
    if not respuesta:
        return jsonify({'message': 'Contale por qué no'}), 400
    p.estado, p.revisor_id, p.revisada_en, p.respuesta = AutPropuesta.RECHAZADA, current_user.id, ahora(), respuesta
    db.session.commit()
    return jsonify(_resumen(p))
