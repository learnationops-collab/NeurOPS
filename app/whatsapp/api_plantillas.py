"""/api/whatsapp/plantillas: gestionar las plantillas de Meta y qué pasa al tocar cada botón. Solo admin y operador.

  · DELETE /plantillas/<nombre>                     → la borra en Meta (y sus respuestas acá).
  · GET    /plantillas/<nombre>/respuestas          → {respuestas: [...], asignables: [{id, nombre}]}
  · PUT    /plantillas/<nombre>/respuestas/<boton>  → {texto, botones: [{titulo, va_a}], asignar_a, etiqueta};
                                                      todo vacío borra la regla (el toque vuelve al setter).
"""
from flask import jsonify, request
from flask_login import login_required

from app import db
from app.automatizaciones import reparto
from app.automatizaciones.transporte import ErrorDeEnvio
from app.decorators import admin_required
from app.models.whatsapp import WaRespuestaBoton
from app.whatsapp import respuestas
from app.whatsapp.api import bp
from app.whatsapp.cliente import ClienteWhatsapp


def _botones_de(nombre):
    """Los textos de los botones de esa plantilla en Meta, o None si no existe."""
    p = next((x for x in ClienteWhatsapp().plantillas() if x['name'] == nombre), None)
    if p is None:
        return None
    return [b.get('text') for c in p.get('components') or [] if c.get('type') == 'BUTTONS' for b in c.get('buttons') or []]


@bp.route('/plantillas/<nombre>', methods=['DELETE'])
@login_required
@admin_required
def borrar_plantilla(nombre):
    try:
        ClienteWhatsapp().borrar_plantilla(nombre)
    except ErrorDeEnvio as error:
        return jsonify({'message': str(error)}), 400
    WaRespuestaBoton.query.filter_by(plantilla=nombre).delete()
    db.session.commit()
    return '', 204


@bp.route('/plantillas/<nombre>/respuestas', methods=['GET'])
@login_required
@admin_required
def respuestas_de(nombre):
    reglas = WaRespuestaBoton.query.filter_by(plantilla=nombre).all()
    return jsonify({'respuestas': [respuestas.a_json(r) for r in reglas],
                    'asignables': [{'id': u.id, 'nombre': u.username} for u in reparto.asignables()]})


@bp.route('/plantillas/<nombre>/respuestas/<path:boton>', methods=['PUT'])
@login_required
@admin_required
def guardar_respuesta(nombre, boton):
    try:
        botones = _botones_de(nombre)
    except ErrorDeEnvio as error:
        return jsonify({'message': f'Meta no respondió: {error}'}), 502
    if botones is None:
        return jsonify({'message': 'Esa plantilla no existe'}), 404
    try:
        campos = respuestas.validar(nombre, boton, request.get_json(silent=True) or {}, botones)
    except ValueError as error:
        return jsonify({'message': str(error)}), 400
    if campos['asignar_a'] and campos['asignar_a'] not in {u.id for u in reparto.asignables()}:
        return jsonify({'message': 'Elegí un setter activo'}), 400
    regla = WaRespuestaBoton.query.filter_by(plantilla=nombre, boton=boton).first()
    if not any(campos.values()):
        if regla:
            db.session.delete(regla)
        db.session.commit()
        return jsonify({'boton': boton, 'texto': '', 'botones': [], 'etiqueta': None, 'asignar_a': None})
    if regla is None:
        regla = WaRespuestaBoton(plantilla=nombre, boton=boton)
        db.session.add(regla)
    for clave, valor in campos.items():
        setattr(regla, clave, valor)
    db.session.commit()
    return jsonify(respuestas.a_json(regla))
