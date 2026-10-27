"""Etiquetas de las conversaciones del Inbox (`tags_service.py`), colgadas del blueprint del Inbox.
Cualquiera crea grupos y pone o saca etiquetas; renombrar o borrar un grupo o una etiqueta es de admin y
dirección comercial (el setter no llega: no está en `ACCIONES_DEL_SETTER`)."""
from flask import jsonify, request
from flask_login import current_user

from app import db
from app.automatizaciones.api import bp
from app.automatizaciones.modelos import IgContacto
from app.models.tag import TARGET_IG_CONTACT, TagGroup
from app.services import tags_service


def _cuerpo():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else {}


def _error(e):
    return jsonify({'message': str(e)}), 400


@bp.route('/etiquetas', methods=['GET'])
def catalogo_etiquetas():
    return jsonify(tags_service.catalogo(TARGET_IG_CONTACT))


@bp.route('/etiquetas/grupos', methods=['POST'])
def crear_grupo_etiquetas():
    datos = _cuerpo()
    try:
        grupo = tags_service.crear_grupo(datos.get('name'), datos.get('exclusive'), current_user.id)
    except tags_service.EtiquetaInvalida as e:
        return _error(e)
    db.session.commit()
    return jsonify({'id': grupo.id, 'name': grupo.name, 'color': grupo.color, 'exclusive': grupo.exclusive, 'tags': []}), 201


@bp.route('/etiquetas/grupos/<int:grupo_id>', methods=['PUT', 'DELETE'])
def editar_grupo_etiquetas(grupo_id):
    grupo = db.session.get(TagGroup, grupo_id)
    if grupo is None:
        return jsonify({'message': 'Not found'}), 404
    if request.method == 'DELETE':
        db.session.delete(grupo)  # sus etiquetas se van con él (ON DELETE CASCADE)
    else:
        try:
            tags_service.editar_grupo(grupo, _cuerpo())
        except tags_service.EtiquetaInvalida as e:
            return _error(e)
    db.session.commit()
    return '', 204


@bp.route('/etiquetas', methods=['DELETE'])
def borrar_etiqueta():
    """Una etiqueta deja de existir: se saca de todas las conversaciones. `group_id` vacío: suelta."""
    datos = _cuerpo()
    tags_service.borrar_etiqueta(TARGET_IG_CONTACT, datos.get('group_id') or None, (datos.get('name') or '').strip())
    db.session.commit()
    return '', 204


@bp.route('/conversaciones/<int:contacto_id>/etiquetas', methods=['POST'])
def poner_etiqueta(contacto_id):
    if db.session.get(IgContacto, contacto_id) is None:
        return jsonify({'message': 'Not found'}), 404
    datos = _cuerpo()
    try:
        tags_service.poner(TARGET_IG_CONTACT, contacto_id, datos.get('group_id') or None, datos.get('name'), current_user.id)
    except tags_service.EtiquetaInvalida as e:
        return _error(e)
    db.session.commit()
    return jsonify({'etiquetas': tags_service.de(TARGET_IG_CONTACT, [contacto_id]).get(str(contacto_id), [])})


@bp.route('/conversaciones/<int:contacto_id>/etiquetas/<int:tag_id>', methods=['DELETE'])
def sacar_etiqueta(contacto_id, tag_id):
    tags_service.sacar(TARGET_IG_CONTACT, contacto_id, tag_id)
    db.session.commit()
    return jsonify({'etiquetas': tags_service.de(TARGET_IG_CONTACT, [contacto_id]).get(str(contacto_id), [])})
