"""Learnito sugiere la próxima respuesta (`sugerir.py`), colgado del blueprint del Inbox y abierto al setter
(`ACCIONES_DEL_SETTER`). No manda nada: devuelve el texto para que el setter lo edite y lo mande."""
from flask import jsonify, request
from flask_login import current_user

from app import db
from app.automatizaciones import sugerir
from app.automatizaciones.acciones import AccionInvalida
from app.automatizaciones.api import bp
from app.automatizaciones.modelos import IgContacto


@bp.route('/conversaciones/<int:contacto_id>/sugerencia', methods=['POST'])
def sugerir_respuesta(contacto_id):
    """`pedido` (opcional): lo que el setter escribió en la caja, como borrador a mejorar o instrucción."""
    contacto = db.session.get(IgContacto, contacto_id)
    if contacto is None:
        return jsonify({'message': 'Not found'}), 404
    from app.automatizaciones import api_trabajo  # cuelga de `bp`: importarlo arriba sería circular
    notas, _ = api_trabajo.historial(contacto.id)
    try:
        datos = sugerir.sugerir(contacto, current_user.id, pedido=(request.get_json(silent=True) or {}).get('pedido'),
                                notas=[n['texto'] for n in notas if n.get('texto')])
    except AccionInvalida as e:
        return jsonify({'message': str(e)}), 400
    return jsonify(datos)
