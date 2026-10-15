"""API del área Inbox (/api/inbox): flujos del motor y conversaciones de Instagram.

Toda ruta exige sesión; la guarda vive en el before_request. Admin y dirección comercial arman y
publican flujos. El setter entra a mirar (solo GET), como en Agendas 2.0.
"""
import json

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.automatizaciones import servicio
from app.automatizaciones.modelos import AutEjecucion, AutFlujo, IgContacto, IgMensaje
from app.automatizaciones.nucleo import grafo as g
from app.models.instagram import InstagramWebhookEvento
from app.models.user import ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL, ROLE_SETTER

bp = Blueprint('inbox', __name__)

ROLES_CON_ACCESO = (ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL)
ROLES_DE_LECTURA = (ROLE_SETTER,)
MAX_BYTES_GRAFO = 300_000
MAX_NODOS = 300
MENSAJES_POR_CONVERSACION = 300

GRAFO_NUEVO = {
    'disparadores': [{'id': 'd1', 'canal': 'dm', 'palabras': [], 'coincidencia': 'exacta'}],
    'inicio': 'n1',
    'nodos': [{'id': 'n1', 'tipo': 'mensaje', 'posicion': {'x': 0, 'y': 0},
               'contenido': [{'tipo': 'texto', 'texto': '¡Hola! 👋'}]}],
    'conexiones': [],
}


@bp.before_request
@login_required
def _guardia():
    if current_user.role in ROLES_CON_ACCESO:
        return None
    if current_user.role in ROLES_DE_LECTURA and request.method == 'GET':
        return None
    return jsonify({'message': 'Forbidden'}), 403


def _cuerpo():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else {}


def _iso(fecha):
    return fecha.isoformat() + 'Z' if fecha else None


def _flujo_o_404(flujo_id):
    flujo = db.session.get(AutFlujo, flujo_id)
    if flujo is None:
        return None, (jsonify({'message': 'Not found'}), 404)
    return flujo, None


def _resumen_flujo(flujo):
    publicada = flujo.version_publicada
    palabras = [p for d in (flujo.grafo or {}).get('disparadores') or [] for p in d.get('palabras') or []]
    return {
        'id': flujo.id,
        'nombre': flujo.nombre,
        'estado': flujo.estado,
        'version': publicada.numero if publicada else None,
        'publicada_en': _iso(publicada.publicada_en) if publicada else None,
        'cambios_sin_publicar': publicada is None or publicada.grafo != flujo.grafo,
        'palabras_clave': palabras,
        'nodos': len((flujo.grafo or {}).get('nodos') or []),
        'ejecuciones_abiertas': AutEjecucion.query.join(AutEjecucion.version).filter(
            AutEjecucion.estado.in_(AutEjecucion.ABIERTOS), AutEjecucion.version.has(flujo_id=flujo.id)).count(),
        'actualizado_en': _iso(flujo.actualizado_en),
    }


def _error_de_grafo(grafo):
    if not isinstance(grafo, dict):
        return 'El flujo no es un documento válido'
    if len(json.dumps(grafo)) > MAX_BYTES_GRAFO:
        return 'El flujo es demasiado grande'
    if len(grafo.get('nodos') or []) > MAX_NODOS:
        return f'Un flujo admite hasta {MAX_NODOS} nodos'
    return None


# --- Estado -----------------------------------------------------------------------------------

@bp.route('/estado', methods=['GET'])
def estado():
    return jsonify({
        'modo': servicio.modo(),
        'puede_editar': current_user.role in ROLES_CON_ACCESO,
        'flujos_activos': AutFlujo.query.filter_by(estado=AutFlujo.ACTIVO).count(),
        'contactos': IgContacto.query.count(),
        'eventos_sin_procesar': InstagramWebhookEvento.query.filter(InstagramWebhookEvento.procesado_en.is_(None)).count(),
    })


# --- Flujos -----------------------------------------------------------------------------------

@bp.route('/flujos', methods=['GET'])
def listar_flujos():
    flujos = AutFlujo.query.order_by(AutFlujo.actualizado_en.desc()).all()
    return jsonify({'flujos': [_resumen_flujo(f) for f in flujos]})


@bp.route('/flujos', methods=['POST'])
def crear_flujo():
    datos = _cuerpo()
    nombre = (datos.get('nombre') or '').strip()[:150]
    if not nombre:
        return jsonify({'message': 'El flujo necesita un nombre'}), 400
    grafo = datos.get('grafo') or json.loads(json.dumps(GRAFO_NUEVO))
    error = _error_de_grafo(grafo)
    if error:
        return jsonify({'message': error}), 400
    flujo = AutFlujo(nombre=nombre, grafo=grafo)
    db.session.add(flujo)
    db.session.commit()
    return jsonify({**_resumen_flujo(flujo), 'grafo': flujo.grafo, 'errores': g.validar(flujo.grafo)}), 201


@bp.route('/flujos/<int:flujo_id>', methods=['GET'])
def ver_flujo(flujo_id):
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    return jsonify({**_resumen_flujo(flujo), 'grafo': flujo.grafo, 'errores': g.validar(flujo.grafo)})


@bp.route('/flujos/<int:flujo_id>', methods=['PUT'])
def guardar_flujo(flujo_id):
    """Guarda el borrador. Lo que corre no cambia hasta publicar."""
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    datos = _cuerpo()
    if 'nombre' in datos:
        nombre = (datos.get('nombre') or '').strip()[:150]
        if not nombre:
            return jsonify({'message': 'El flujo necesita un nombre'}), 400
        flujo.nombre = nombre
    if 'grafo' in datos:
        problema = _error_de_grafo(datos['grafo'])
        if problema:
            return jsonify({'message': problema}), 400
        flujo.grafo = datos['grafo']
    db.session.commit()
    return jsonify({**_resumen_flujo(flujo), 'grafo': flujo.grafo, 'errores': g.validar(flujo.grafo)})


@bp.route('/flujos/<int:flujo_id>/publicar', methods=['POST'])
def publicar_flujo(flujo_id):
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    errores = servicio.publicar(flujo)
    if errores:
        return jsonify({'message': 'El flujo tiene errores', 'errores': errores}), 422
    return jsonify(_resumen_flujo(flujo))


@bp.route('/flujos/<int:flujo_id>/pausar', methods=['POST'])
def pausar_flujo(flujo_id):
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    if flujo.version_publicada_id:
        flujo.estado = AutFlujo.PAUSADO
        db.session.commit()
    return jsonify(_resumen_flujo(flujo))


@bp.route('/flujos/<int:flujo_id>/activar', methods=['POST'])
def activar_flujo(flujo_id):
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    if not flujo.version_publicada_id:
        return jsonify({'message': 'Publicalo primero: no hay ninguna versión para activar'}), 409
    flujo.estado = AutFlujo.ACTIVO
    db.session.commit()
    return jsonify(_resumen_flujo(flujo))


@bp.route('/flujos/<int:flujo_id>', methods=['DELETE'])
def borrar_flujo(flujo_id):
    """Solo un borrador que nunca se publicó: lo publicado deja historia (ejecuciones y mensajes)."""
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    if flujo.version_publicada_id:
        return jsonify({'message': 'Un flujo publicado no se borra: pausalo'}), 409
    db.session.delete(flujo)
    db.session.commit()
    return '', 204


# --- Conversaciones ---------------------------------------------------------------------------

@bp.route('/conversaciones', methods=['GET'])
def listar_conversaciones():
    buscar = (request.args.get('buscar') or '').strip().lower()
    limite = min(max(request.args.get('limite', 100, type=int) or 100, 1), 300)
    ultimo = (db.session.query(IgMensaje.contacto_id, db.func.max(IgMensaje.enviado_en).label('ultimo'),
                               db.func.count(IgMensaje.id).label('cantidad'))
              .group_by(IgMensaje.contacto_id).subquery())
    consulta = (db.session.query(IgContacto, ultimo.c.ultimo, ultimo.c.cantidad)
                .join(ultimo, ultimo.c.contacto_id == IgContacto.id))
    if buscar:
        patron = f'%{buscar}%'
        consulta = consulta.filter(db.or_(db.func.lower(IgContacto.username).like(patron),
                                          db.func.lower(IgContacto.nombre).like(patron),
                                          IgContacto.igsid.like(patron)))
    filas = consulta.order_by(ultimo.c.ultimo.desc()).limit(limite).all()
    salida = []
    for contacto, momento, cantidad in filas:
        mensaje = (IgMensaje.query.filter_by(contacto_id=contacto.id)
                   .order_by(IgMensaje.enviado_en.desc(), IgMensaje.id.desc()).first())
        salida.append({
            'id': contacto.id,
            'igsid': contacto.igsid,
            'username': contacto.username,
            'nombre': contacto.nombre,
            'mensajes': cantidad,
            'ultimo_en': _iso(momento),
            'ultimo_texto': (mensaje.texto or '')[:140] if mensaje else '',
            'ultimo_de': mensaje.origen if mensaje else None,
            'bot_pausado': bool(contacto.bot_pausado_hasta and contacto.bot_pausado_hasta > servicio.ahora()),
        })
    return jsonify({'conversaciones': salida})


@bp.route('/conversaciones/<int:contacto_id>', methods=['GET'])
def ver_conversacion(contacto_id):
    contacto = db.session.get(IgContacto, contacto_id)
    if contacto is None:
        return jsonify({'message': 'Not found'}), 404
    mensajes = (IgMensaje.query.filter_by(contacto_id=contacto.id)
                .order_by(IgMensaje.enviado_en.desc(), IgMensaje.id.desc()).limit(MENSAJES_POR_CONVERSACION).all())
    ejecucion = (AutEjecucion.query.filter_by(contacto_id=contacto.id).order_by(AutEjecucion.id.desc()).first())
    return jsonify({
        'contacto': {
            'id': contacto.id, 'igsid': contacto.igsid, 'username': contacto.username, 'nombre': contacto.nombre,
            'variables': contacto.variables or {}, 'ultimo_entrante_en': _iso(contacto.ultimo_entrante_en),
            'bot_pausado_hasta': _iso(contacto.bot_pausado_hasta),
        },
        'ejecucion': {
            'flujo': ejecucion.version.flujo.nombre, 'estado': ejecucion.estado, 'nodo': ejecucion.nodo_actual,
            'detalle': ejecucion.detalle,
        } if ejecucion else None,
        'mensajes': [{
            'id': m.id, 'direccion': m.direccion, 'origen': m.origen, 'texto': m.texto,
            'adjuntos': [a.get('type') for a in (m.contenido or {}).get('adjuntos') or []]
            if isinstance(m.contenido, dict) else [],
            'botones': _botones(m.contenido), 'en': _iso(m.enviado_en),
        } for m in reversed(mensajes)],
    })


def _botones(contenido):
    """Los títulos de los botones de un mensaje que mandó el motor."""
    if not isinstance(contenido, dict):
        return []
    if contenido.get('quick_replies'):
        return [b.get('title') for b in contenido['quick_replies']]
    plantilla = (contenido.get('attachment') or {}).get('payload') or {}
    return [b.get('title') for b in plantilla.get('buttons') or []]
