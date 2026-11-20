"""Lo nuevo del Inbox en el espacio del setter (ADR-W184): mover la conversación de fase del setting,
marcarle el canal, anotar una cita de un mensaje del lead para la venta y etiquetar varias de una vez.
Colgado del blueprint del Inbox; el setter llega por `ACCIONES_DEL_SETTER`."""
from flask import jsonify, request
from flask_login import current_user

from app import db
from app.automatizaciones import fases, progreso, servicio
from app.automatizaciones.api import bp
from app.automatizaciones.api_trabajo import _contacto_o_404, evento
from app.automatizaciones.modelos import IgContacto, IgMensaje
from app.models.inbox_work import CITA, Note
from app.models.tag import TARGET_IG_CONTACT
from app.services import tags_service

TIPOS_CITA = ('Dolor', 'Objeción', 'Motivación', 'Dato')
LARGO_CITA = 1000
MAX_MASIVO = 200


def _cuerpo():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else {}


def cita_json(n):
    p = n.payload or {}
    return {'id': n.id, 'texto': p.get('texto'), 'tipo': p.get('tipo'), 'mensaje_id': p.get('mensaje_id'),
            'comentario': n.body, 'autor': n.author.username if n.author else None,
            'en': n.created_at.isoformat() + 'Z'}


def citas(contacto_id):
    filas = (Note.query.filter_by(target_type=TARGET_IG_CONTACT, target_id=str(contacto_id), kind=CITA)
             .order_by(Note.created_at.desc()).limit(100).all())
    return [cita_json(n) for n in filas]


@bp.route('/conversaciones/<int:contacto_id>/fase', methods=['PUT'])
def mover_fase(contacto_id):
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    fase = _cuerpo().get('fase')
    if fase not in fases.TODAS:
        return jsonify({'message': 'Fase desconocida'}), 400
    ahora = servicio.ahora()
    desde = progreso.uno(contacto, ahora, current_user.id).get('fase')
    if fase != desde:
        fases.mover(contacto, fase, current_user.id, desde)
        evento(contacto.id, f'Fase: {fases.NOMBRES[fase]}')
        db.session.commit()
    return jsonify({**progreso.uno(contacto, ahora, current_user.id), 'fases': fases.historial(contacto.id)})


@bp.route('/conversaciones/<int:contacto_id>/canal', methods=['PUT'])
def marcar_canal(contacto_id):
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    canal = _cuerpo().get('canal')
    if canal not in fases.CANALES:
        return jsonify({'message': 'Canal desconocido'}), 400
    contacto.canal = canal
    evento(contacto.id, f'Canal: {canal.capitalize()}')
    db.session.commit()
    return jsonify({'canal': canal})


@bp.route('/conversaciones/<int:contacto_id>/citas', methods=['POST'])
def anotar_cita(contacto_id):
    """`texto`: lo resaltado de un mensaje del lead; `tipo`, `comentario` y `mensaje_id`. La ficha del lead
    (Comunicación) la muestra como nota del setter."""
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    datos = _cuerpo()
    texto = str(datos.get('texto') or '').strip()[:LARGO_CITA]
    tipo = datos.get('tipo') if datos.get('tipo') in TIPOS_CITA else 'Dato'
    if not texto:
        return jsonify({'message': 'Resaltá una parte del mensaje'}), 400
    mensaje_id = datos.get('mensaje_id')
    if mensaje_id is not None and not IgMensaje.query.filter_by(id=mensaje_id, contacto_id=contacto.id).first():
        mensaje_id = None
    nota = Note(target_type=TARGET_IG_CONTACT, target_id=str(contacto.id), kind=CITA,
                body=str(datos.get('comentario') or '').strip()[:LARGO_CITA],
                payload={'texto': texto, 'tipo': tipo, 'mensaje_id': mensaje_id}, created_by=current_user.id)
    db.session.add(nota)
    db.session.commit()
    return jsonify(cita_json(nota)), 201


@bp.route('/etiquetas/masivo', methods=['POST'])
def etiquetar_varias():
    """`contactos`: ids; `etiquetas`: [{group_id, name}]. Se suman a las que ya tienen (en un grupo exclusivo,
    reemplaza la del grupo)."""
    datos = _cuerpo()
    ids = [i for i in (datos.get('contactos') or []) if isinstance(i, int)][:MAX_MASIVO]
    etiquetas = [e for e in (datos.get('etiquetas') or []) if isinstance(e, dict)][:20]
    if not ids or not etiquetas:
        return jsonify({'message': 'Elegí conversaciones y etiquetas'}), 400
    existentes = {c for (c,) in db.session.query(IgContacto.id).filter(IgContacto.id.in_(ids)).all()}
    try:
        for cid in existentes:
            for e in etiquetas:
                tags_service.poner(TARGET_IG_CONTACT, cid, e.get('group_id') or None, e.get('name'), current_user.id)
    except tags_service.EtiquetaInvalida as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 400
    db.session.commit()
    return jsonify({'etiquetadas': len(existentes),
                    'etiquetas': {str(k): v for k, v in tags_service.de(TARGET_IG_CONTACT, list(existentes)).items()}})
