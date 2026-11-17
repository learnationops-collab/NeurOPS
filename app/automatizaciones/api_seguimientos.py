"""Programar y cancelar seguimientos condicionales (`seguimientos.py`) desde el chat, colgado del blueprint
del Inbox y abierto al setter (`ACCIONES_DEL_SETTER`)."""
from flask import jsonify, request
from flask_login import current_user

from app import db
from app.automatizaciones import seguimientos, servicio
from app.automatizaciones.acciones import AccionInvalida
from app.automatizaciones.api import bp
from app.automatizaciones.api_escribir import NO_ACEPTA_IG, url_publica_de
from app.automatizaciones.modelos import AutSeguimiento, IgContacto
from app.models.inbox_work import AudioClip


@bp.route('/conversaciones/<int:contacto_id>/seguimientos', methods=['POST'])
def programar_seguimiento(contacto_id):
    """`horas` y `texto` o `audio_id`; `pausar` como al escribir a mano."""
    contacto = db.session.get(IgContacto, contacto_id)
    if contacto is None:
        return jsonify({'message': 'Not found'}), 404
    datos = request.get_json(silent=True) or {}
    audio = None
    if datos.get('audio_id'):
        audio = db.session.get(AudioClip, int(datos['audio_id']))
        if audio is None:
            return jsonify({'message': 'Ese audio ya no está'}), 404
        if audio.mime in NO_ACEPTA_IG:
            return jsonify({'message': 'Instagram no reproduce ogg ni webm: subilo en m4a, mp3 o wav'}), 400
    try:
        s = seguimientos.programar(contacto, current_user.id, datos.get('horas'), servicio.ahora(),
                                   texto=datos.get('texto'), audio=audio,
                                   url_audio=url_publica_de(audio.id) if audio else None,
                                   pausar=datos.get('pausar', True) is not False)
    except AccionInvalida as e:
        return jsonify({'message': str(e)}), 400
    db.session.commit()
    return jsonify(seguimientos.resumen(s)), 201


@bp.route('/seguimientos/<int:seguimiento_id>', methods=['DELETE'])
def cancelar_seguimiento(seguimiento_id):
    s = db.session.get(AutSeguimiento, seguimiento_id)
    if s is None:
        return jsonify({'message': 'Not found'}), 404
    try:
        seguimientos.cancelar(s, servicio.ahora(), f'Lo canceló {current_user.username}')
    except AccionInvalida as e:
        return jsonify({'message': str(e)}), 409
    db.session.commit()
    return jsonify(seguimientos.resumen(s))
