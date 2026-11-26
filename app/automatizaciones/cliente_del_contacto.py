"""Quién es el lead de una conversación en Work: el `Client` con su número de WhatsApp (en sus dos formas, 52/521 o
54/549) o con su @ de Instagram, y su última agenda. Así un contacto que en WhatsApp se llama «👻» se lee con el
nombre que dejó al agendar."""
from sqlalchemy import func

from app.models import Appointment, Client
from app.whatsapp.cliente import es_whatsapp, telefono_de, variantes


def _cliente(contacto):
    if es_whatsapp(contacto.igsid):
        numeros = variantes(telefono_de(contacto.igsid))
        formas = list(numeros) + [f'+{n}' for n in numeros]
        return Client.query.filter(Client.phone.in_(formas)).order_by(Client.id.desc()).first()
    if contacto.username:
        usuario = contacto.username.lstrip('@').lower()
        return Client.query.filter(func.lower(func.trim(Client.instagram)).in_([usuario, f'@{usuario}'])) \
            .order_by(Client.id.desc()).first()
    return None


def de(contacto):
    """{id, nombre, email, agenda: {con, en, resultado}} o None."""
    cliente = _cliente(contacto)
    if cliente is None:
        return None
    agenda = Appointment.query.filter_by(client_id=cliente.id).order_by(Appointment.start_time.desc()).first()
    return {
        'id': cliente.id, 'nombre': cliente.full_name, 'email': cliente.email,
        'agenda': {
            'con': agenda.closer.username if agenda.closer_id and agenda.closer else None,
            'en': agenda.start_time.isoformat() + 'Z' if agenda.start_time else None,
            'resultado': agenda.seguimiento_sub or agenda.closer_result,
        } if agenda else None,
    }
