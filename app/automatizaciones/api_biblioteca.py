"""Lo que el equipo comparte para contestar: respuestas rápidas y audios subidos (27/10/2026). Cualquiera
del equipo los crea; borrar es de quien lo creó o de admin y dirección comercial. Colgado del blueprint
del Inbox; el setter llega por `ACCIONES_DEL_SETTER`."""
import re

from flask import Response, jsonify, request
from flask_login import current_user
from sqlalchemy.orm import defer

from app import db
from app.automatizaciones.api import ROLES_CON_ACCESO, bp
from app.models.inbox_work import AudioClip, QuickReply

MAX_AUDIO = 8 * 1024 * 1024  # 8 MB: Instagram acepta audios de hasta 25 MB, pero viven en la base
TIPOS_AUDIO = ('audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm')
ATAJO = re.compile(r'^[a-z0-9_]{1,30}$')


def _puede_borrar(creado_por):
    return current_user.role in ROLES_CON_ACCESO or creado_por == current_user.id


def _rapida(r):
    return {'id': r.id, 'atajo': r.shortcut, 'titulo': r.title, 'texto': r.body, 'puede_borrar': _puede_borrar(r.created_by)}


def _audio(a):
    return {'id': a.id, 'nombre': a.name, 'duracion': a.duration_s, 'tamano': a.size,
            'autor': a.author.username if a.author else None, 'en': a.created_at.isoformat() + 'Z',
            'puede_borrar': _puede_borrar(a.created_by)}


@bp.route('/respuestas-rapidas', methods=['GET'])
def listar_rapidas():
    return jsonify({'respuestas': [_rapida(r) for r in QuickReply.query.order_by(QuickReply.shortcut).all()]})


@bp.route('/respuestas-rapidas', methods=['POST'])
def crear_rapida():
    datos = request.get_json(silent=True) or {}
    atajo = str(datos.get('atajo') or '').strip().lstrip('/').lower()
    titulo = str(datos.get('titulo') or '').strip()[:80]
    texto = str(datos.get('texto') or '').strip()[:1000]
    if not ATAJO.match(atajo) or not titulo or not texto:
        return jsonify({'message': 'El atajo va en minúsculas y sin espacios (ej.: precio), con título y texto'}), 400
    if QuickReply.query.filter_by(shortcut=atajo).first():
        return jsonify({'message': f'Ya existe /{atajo}'}), 409
    r = QuickReply(shortcut=atajo, title=titulo, body=texto, created_by=current_user.id)
    db.session.add(r)
    db.session.commit()
    return jsonify(_rapida(r)), 201


@bp.route('/respuestas-rapidas/<int:rapida_id>', methods=['DELETE'])
def borrar_rapida(rapida_id):
    r = db.session.get(QuickReply, rapida_id)
    if r is None:
        return jsonify({'message': 'Not found'}), 404
    if not _puede_borrar(r.created_by):
        return jsonify({'message': 'Solo la borra quien la creó'}), 403
    db.session.delete(r)
    db.session.commit()
    return '', 204


@bp.route('/audios', methods=['GET'])
def listar_audios():
    audios = AudioClip.query.options(defer(AudioClip.data)).order_by(AudioClip.created_at.desc()).all()
    return jsonify({'audios': [_audio(a) for a in audios]})


@bp.route('/audios', methods=['POST'])
def subir_audio():
    archivo = request.files.get('archivo')
    nombre = (request.form.get('nombre') or '').strip()[:120]
    if archivo is None or not nombre:
        return jsonify({'message': 'Falta el audio o su nombre'}), 400
    tipo = (archivo.mimetype or '').split(';')[0]
    if tipo not in TIPOS_AUDIO:
        return jsonify({'message': 'Subí un audio (mp3, m4a, ogg, wav o webm)'}), 400
    datos = archivo.read(MAX_AUDIO + 1)
    if len(datos) > MAX_AUDIO:
        return jsonify({'message': 'El audio pesa más de 8 MB'}), 400
    duracion = request.form.get('duracion', type=float)
    a = AudioClip(name=nombre, mime=tipo, size=len(datos), data=datos, created_by=current_user.id,
                  duration_s=round(duracion) if duracion else None)
    db.session.add(a)
    db.session.commit()
    return jsonify(_audio(a)), 201


@bp.route('/audios/<int:audio_id>/archivo', methods=['GET'])
def archivo_audio(audio_id):
    a = db.session.get(AudioClip, audio_id)
    if a is None:
        return jsonify({'message': 'Not found'}), 404
    return Response(a.data, mimetype=a.mime, headers={'Cache-Control': 'private, max-age=86400'})


@bp.route('/audios/<int:audio_id>', methods=['DELETE'])
def borrar_audio(audio_id):
    a = db.session.get(AudioClip, audio_id)
    if a is None:
        return jsonify({'message': 'Not found'}), 404
    if not _puede_borrar(a.created_by):
        return jsonify({'message': 'Solo lo borra quien lo subió'}), 403
    db.session.delete(a)
    db.session.commit()
    return '', 204
