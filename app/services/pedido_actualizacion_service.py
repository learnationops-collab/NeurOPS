"""«Pedir actualización» sobre una sesión (ADR-W275): el pedido va a quien confirma y la respuesta vuelve a
quien pidió, los dos con aviso en la campanita. Desde el 27/11/2026 Dari confirma todas las sesiones."""
import unicodedata
from datetime import datetime, timedelta

from sqlalchemy.orm import defer

from app import db
from app.models import Client, UpdateRequest, User
from app.services import avisos_service

MAX_AUDIO = 8 * 1024 * 1024
ROL_CONFIRMA = 'triage'
NOMBRE_CONFIRMA = 'dari'


class PedidoError(Exception):
    def __init__(self, mensaje, codigo=400):
        super().__init__(mensaje)
        self.codigo = codigo


def _plano(texto):
    return unicodedata.normalize('NFKD', texto or '').encode('ascii', 'ignore').decode().lower()


def quien_confirma():
    """Dari (la persona activa con rol triage que se llama así). Sin ella, None: el pedido va al rol."""
    candidatos = User.query.filter(User.role == ROL_CONFIRMA, User.is_active.is_(True)).all()
    return next((u for u in candidatos if _plano(u.username).startswith(NOMBRE_CONFIRMA)), None)


def _nombre_lead(appt):
    cliente = db.session.get(Client, appt.client_id) if appt.client_id else None
    return (cliente.full_name if cliente else None) or 'un lead'


def _audio(archivo):
    if not archivo:
        return None, None
    datos = archivo.read()
    if not datos:
        return None, None
    if len(datos) > MAX_AUDIO:
        raise PedidoError('El audio supera los 8 MB.')
    tipo = (archivo.mimetype or 'audio/webm').split(';')[0]
    if not tipo.startswith('audio/'):
        raise PedidoError('El archivo no es un audio.')
    return datos, tipo


def _resumen(texto, hay_audio):
    texto = (texto or '').strip()
    if texto:
        return texto[:280]
    return 'Mandó un audio.' if hay_audio else ''


def puede_responder(pedido, usuario):
    return (pedido.replied_at is None
            and (usuario.id == pedido.recipient_id or usuario.tiene_rol(ROL_CONFIRMA) or usuario.tiene_rol('admin')))


def crear(appt, usuario, mensaje, archivo):
    mensaje = (mensaje or '').strip()
    audio, tipo = _audio(archivo)
    para = quien_confirma()
    pedido = UpdateRequest(appointment_id=appt.id, person_uuid=appt.person_uuid, requested_by=usuario.id,
                           recipient_id=para.id if para else None, message=mensaje or None,
                           audio=audio, audio_mime=tipo)
    db.session.add(pedido)
    db.session.flush()
    destino = ('user', para.id) if para else ('rol', ROL_CONFIRMA)
    avisos_service.avisar('pedido_actualizacion', *destino,
                          f'{usuario.username} pide actualización de {_nombre_lead(appt)}',
                          _resumen(mensaje, audio), origen='appointment', origen_id=appt.id,
                          person_uuid=appt.person_uuid, payload={'pedido_id': pedido.id})
    db.session.commit()
    return pedido


def responder(pedido, usuario, texto, archivo):
    if not puede_responder(pedido, usuario):
        raise PedidoError('Este pedido ya tiene respuesta o no es para vos.', 403)
    texto = (texto or '').strip()
    audio, tipo = _audio(archivo)
    if not texto and not audio:
        raise PedidoError('Escribí o grabá la respuesta.')
    pedido.reply, pedido.reply_audio, pedido.reply_audio_mime = texto or None, audio, tipo
    pedido.replied_by, pedido.replied_at = usuario.id, datetime.utcnow()
    from app.models import Appointment

    appt = db.session.get(Appointment, pedido.appointment_id)
    if pedido.requested_by:
        avisos_service.avisar('respuesta_actualizacion', 'user', pedido.requested_by,
                              f'{usuario.username} respondió sobre {_nombre_lead(appt)}',
                              _resumen(texto, audio), origen='appointment', origen_id=pedido.appointment_id,
                              person_uuid=pedido.person_uuid, payload={'pedido_id': pedido.id})
    db.session.commit()
    return pedido


def _iso(dt):
    return dt.isoformat() + 'Z' if dt else None


def a_dict(p, usuario):
    return {
        'id': p.id,
        'de': p.requester.username if p.requester else None,
        'para': p.recipient.username if p.recipient else 'Triage',
        'mensaje': p.message,
        'con_audio': p.audio_mime is not None,
        'creado': _iso(p.created_at),
        'respuesta': p.reply,
        'respuesta_con_audio': p.reply_audio_mime is not None,
        'respondio': p.replier.username if p.replier else None,
        'respondido': _iso(p.replied_at),
        'puede_responder': puede_responder(p, usuario),
    }


def de_la_agenda(appt_id):
    return (UpdateRequest.query.filter_by(appointment_id=appt_id)
            .options(defer(UpdateRequest.audio), defer(UpdateRequest.reply_audio))
            .order_by(UpdateRequest.created_at.desc()).all())


def urgentes(usuario):
    """Los avisos de pedidos y respuestas sin leer del último día: lo que el toast muestra al toque."""
    desde = datetime.utcnow() - timedelta(days=1)
    salida = []
    for tipo in ('pedido_actualizacion', 'respuesta_actualizacion'):
        salida += [a for a in avisos_service.de(usuario, tipo, desde) if not avisos_service.leido(a, usuario)]
    return [avisos_service.a_dict(a, usuario) for a in sorted(salida, key=lambda a: a.created_at, reverse=True)]
