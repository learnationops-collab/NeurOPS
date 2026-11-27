"""/api/whatsapp/plantillas: gestionar las plantillas de Meta y qué pasa al tocar cada botón. Borrar, solo admin y operador; las respuestas, también quien usa Workshop (ADR-W259).

  · DELETE /plantillas/<nombre>                     → la borra en Meta (y sus respuestas acá).
  · GET    /plantillas/<nombre>/respuestas          → {respuestas: [...], config, asignables: [{id, nombre}]}
  · PUT    /plantillas/<nombre>/respuestas/<boton>  → {texto, botones: [{titulo, va_a} | {titulo, url}], asignar_a,
                                                      etiqueta, demora_segundos}; todo vacío borra la regla.
  · PUT    /plantillas/<nombre>/config              → {opcion_unica, texto_repetida} (ADR-W260).
"""
from flask import jsonify, request
from flask_login import login_required

from app import db
from app.automatizaciones import reparto
from app.automatizaciones.transporte import ErrorDeEnvio
from app.decorators import admin_required, workshop_required
from app.models.whatsapp import WaPlantillaConfig, WaRespuestaBoton
from app.whatsapp import respuestas
from app.whatsapp.api import bp
from app.whatsapp.cliente import ClienteWhatsapp


def _botones_de(nombre):
    """Los textos de los botones de esa plantilla en Meta, o None si no existe. `paso:<id>`: los de un paso de
    mensaje común (ADR-W272), más su link si tiene."""
    if nombre.startswith('paso:'):
        from app.models.whatsapp_taller import WaPasoTaller
        from app.whatsapp.respuestas import LINK_BOTON
        paso = db.session.get(WaPasoTaller, int(nombre[5:])) if nombre[5:].isdigit() else None
        if paso is None:
            return None
        m = paso.mensaje or {}
        return [b['titulo'] for b in m.get('botones') or []] + ([LINK_BOTON] if m.get('url') else [])
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
    WaPlantillaConfig.query.filter_by(plantilla=nombre).delete()
    db.session.commit()
    return '', 204


@bp.route('/plantillas/<nombre>/respuestas', methods=['GET'])
@login_required
@workshop_required
def respuestas_de(nombre):
    reglas = WaRespuestaBoton.query.filter_by(plantilla=nombre).all()
    return jsonify({'respuestas': [respuestas.a_json(r) for r in reglas], 'config': respuestas.config_json(nombre),
                    'asignables': [{'id': u.id, 'nombre': u.username} for u in reparto.asignables()]})


@bp.route('/plantillas/<nombre>/config', methods=['PUT'])
@login_required
@workshop_required
def guardar_config(nombre):
    """{opcion_unica, texto_repetida}: opción única para los botones de esa plantilla (ADR-W260)."""
    try:
        return jsonify(respuestas.guardar_config(nombre, request.get_json(silent=True) or {}))
    except ValueError as error:
        return jsonify({'message': str(error)}), 400


@bp.route('/plantillas/<nombre>/respuestas/<path:boton>', methods=['PUT'])
@login_required
@workshop_required
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
        return jsonify({'boton': boton, 'texto': '', 'botones': [], 'etiqueta': None, 'asignar_a': None, 'demora_segundos': 0})
    if regla is None:
        regla = WaRespuestaBoton(plantilla=nombre, boton=boton)
        db.session.add(regla)
    for clave, valor in campos.items():
        setattr(regla, clave, valor)
    db.session.commit()
    return jsonify(respuestas.a_json(regla))
