"""Escribirle al lead desde el Inbox (`escribir.py`), colgado del blueprint del Inbox y abierto al setter
(`ACCIONES_DEL_SETTER`). Para mandar un audio, Meta lo baja de una URL pública: `bp_publico` lo sirve con
un link firmado que vence, sin sesión."""
import os

from flask import Blueprint, Response, current_app, jsonify, request
from flask_login import current_user
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app import db
from app.automatizaciones import acciones, escribir, guia, servicio
from app.automatizaciones.api import bp
from app.automatizaciones.modelos import IgContacto
from app.models.inbox_work import AudioClip

bp_publico = Blueprint('inbox_publico', __name__)
SAL_AUDIO = 'inbox-audio'
VIGENCIA_LINK = 7 * 24 * 3600  # Meta lo baja en el momento; una semana sobra
# Instagram no reproduce estos: hay que subirlos en m4a, aac, wav o mp3.
NO_ACEPTA_IG = ('audio/ogg', 'audio/webm')


def _firmador():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SAL_AUDIO)


def url_publica_de(audio_id):
    base = (os.environ.get('FRONTEND_URL') or request.url_root).rstrip('/')
    if base.startswith('http://') and 'localhost' not in base and '127.0.0.1' not in base:
        base = 'https://' + base[len('http://'):]
    return f'{base}/api/inbox-publico/audios/{_firmador().dumps(audio_id)}'


@bp.route('/conversaciones/<int:contacto_id>/escribir', methods=['POST'])
def escribir_al_lead(contacto_id):
    """`texto` o `audio_id`; `guia`, el paso de la Guía que se mandó (`fase:paso:opción`). Devuelve el mensaje
    como lo muestra el chat."""
    datos = request.get_json(silent=True) or {}
    audio = None
    if datos.get('audio_id'):
        audio = db.session.get(AudioClip, int(datos['audio_id']))
        if audio is None:
            return jsonify({'message': 'Ese audio ya no está'}), 404
        if audio.mime in NO_ACEPTA_IG:
            return jsonify({'message': 'Instagram no reproduce ogg ni webm: subilo en m4a, mp3 o wav'}), 400
    try:
        with servicio.con_motor() as motor:
            contacto = db.session.get(IgContacto, contacto_id)
            if contacto is None:
                return jsonify({'message': 'Not found'}), 404
            mensaje = escribir.enviar(motor, contacto, current_user.id, texto=datos.get('texto'),
                                      url_audio=url_publica_de(audio.id) if audio else None,
                                      nombre_audio=audio.name if audio else None,
                                      pausar=datos.get('pausar', True) is not False,
                                      guia=guia.clave_valida(datos.get('guia')))
            # La casilla «Seguimiento» del chat (ADR-W255): sin tocarla no viene y decide la regla de las 12 h.
            if isinstance(datos.get('seguimiento'), bool):
                mensaje.seguimiento = datos['seguimiento']
            hasta = contacto.bot_pausado_hasta
            respuesta = {'id': mensaje.id, 'texto': mensaje.texto, 'en': mensaje.enviado_en.isoformat() + 'Z',
                         'bot_pausado_hasta': hasta.isoformat() + 'Z' if hasta else None}
    except acciones.AccionInvalida as e:
        return jsonify({'message': str(e)}), 400
    except servicio.MotorApagado:
        return jsonify({'message': 'El motor está apagado: no se puede escribir'}), 409
    except servicio.MotorOcupado:
        return jsonify({'message': 'El motor está ocupado, probá de nuevo en unos segundos'}), 409
    return jsonify(respuesta), 201


@bp_publico.route('/audios/<token>', methods=['GET'])
def audio_publico(token):
    try:
        audio_id = _firmador().loads(token, max_age=VIGENCIA_LINK)
    except (BadSignature, SignatureExpired):
        return jsonify({'message': 'Link vencido'}), 404
    a = db.session.get(AudioClip, audio_id)
    if a is None:
        return jsonify({'message': 'Not found'}), 404
    return Response(a.data, mimetype=a.mime, headers={'Cache-Control': 'public, max-age=3600'})
