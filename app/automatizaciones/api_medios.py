"""El archivo de un mensaje de WhatsApp (sticker, foto, audio, video, documento), para verlo en el chat.
Colgado del blueprint del Inbox: es un GET, así que el setter también llega."""
from flask import Response, jsonify

from app import db
from app.automatizaciones.api import bp
from app.automatizaciones.modelos import IgMensaje
from app.automatizaciones.transporte import ErrorDeEnvio
from app.whatsapp import medios


@bp.route('/conversaciones/<int:contacto_id>/mensajes/<int:mensaje_id>/medio', methods=['GET'])
def medio_de_mensaje(contacto_id, mensaje_id):
    mensaje = db.session.get(IgMensaje, mensaje_id)
    datos = medios.medio(mensaje) if mensaje and mensaje.contacto_id == contacto_id else None
    if datos is None:
        return jsonify({'message': 'Not found'}), 404
    try:
        contenido, mime = medios.descargar(datos['media_id'])
    except ErrorDeEnvio as error:
        return jsonify({'message': f'WhatsApp ya no lo tiene: {error}'}), 410
    # El id de Meta no cambia: el navegador lo guarda una semana y no lo vuelve a pedir.
    return Response(contenido, mimetype=mime, headers={'Cache-Control': 'private, max-age=604800'})
