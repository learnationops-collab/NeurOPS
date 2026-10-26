"""Las conversaciones (`Conversation`, la tabla que era `manychat_leads`; 23/10/2026): cada una queda con
su persona.

Las escribe el motor propio de Instagram (`automatizaciones/registro.py`) y, mientras termina de apagarse,
el webhook de ManyChat. Este módulo las sigue en `before_flush`, así cualquiera que las escriba (el motor,
el webhook, el setter, Marketing) deja la persona sin tocar cada camino:

  · El id de suscriptor de ManyChat (solo dígitos) o el usuario de Instagram del motor alcanzan para
    encontrarla o crearla.
  · Las armadas a mano (`synth_`, `manual_`) solo se vinculan a una persona que ya exista, por Instagram y
    nombre compatible: crearla ahí duplicaría al cliente.
"""
import logging
from datetime import datetime
from uuid import uuid4

from sqlalchemy import event

from app import db
from app.models import Conversation, Person
from app.services import person_service

logger = logging.getLogger(__name__)

PREFIJO_INSTAGRAM = 'ig:'  # el motor propio de Instagram (`automatizaciones/registro.py`)
_estado = {'registrado': False}


def external_id_real(external_id):
    """El id de suscriptor de ManyChat si es uno de verdad (solo dígitos); el resto lleva prefijo."""
    eid = str(external_id or '').strip()
    return eid if eid.isdigit() else None


def persona_de(nombre, *, crear, fuente='instagram', actual_uuid=None, **datos):
    """La persona de una conversación, sin flush (sirve dentro de `before_flush`). Le anota los datos."""
    nombre = person_service.nombre_limpio(nombre)
    pares = person_service.claves(**datos)
    person = person_service.por_uuid(actual_uuid) if actual_uuid else None
    if person is None:
        person = person_service.buscar(nombre, **datos)
    if person is None:
        if not crear or not pares:
            return None
        phone = datos.get('phone')
        person = Person(uuid=str(uuid4()), full_name=nombre or None,
                        phone=str(phone).strip() if person_service.normalizar('phone', phone) else None)
        db.session.add(person)
    elif nombre and not person.full_name:
        person.full_name = nombre
    if pares:
        person_service.anotar(person, pares, fuente)
    return person


def sincronizar(conv):
    """La persona de la conversación."""
    if not conv.external_id:
        return None
    real = external_id_real(conv.external_id)
    del_motor = conv.external_id.startswith(PREFIJO_INSTAGRAM)
    person = persona_de(conv.name, crear=bool(real) or del_motor, actual_uuid=conv.person_uuid,
                        instagram=conv.ig, manychat_id=real)
    if person is not None:
        conv.person = person
    return person


def de_persona(person_uuid):
    """La conversación de la persona (la más reciente, si tiene varias), o None. Es lo primero con que se
    busca la conversación de alguien del sistema; el Instagram y el nombre quedan de respaldo."""
    if not person_uuid:
        return None
    return Conversation.query.filter(Conversation.person_uuid == person_uuid) \
        .order_by(Conversation.created_at.desc(), Conversation.id.desc()).first()


def cliente_de(conv):
    """El cliente de la conversación: el de su persona y, si no tiene, el de su Instagram. Si no hay
    ninguno lo crea (con su persona, si ya la tiene). No hace commit."""
    from sqlalchemy import func
    from app.models import Client

    person = person_service.por_uuid(conv.person_uuid) if conv.person_uuid else None
    client = person_service.cliente_de(person, crear=False)
    if client is not None:
        return client
    ig = (conv.ig or '').strip().replace('@', '').lower()
    if ig:
        client = Client.query.filter(func.lower(func.replace(Client.instagram, '@', '')) == ig).first()
    if client is None and person is not None:
        client = person_service.cliente_de(person)
    if client is None:
        client = Client(full_name=conv.name or 'Sin Nombre', instagram=conv.ig, created_at=datetime.utcnow())
        db.session.add(client)
    return client


def _al_guardar(session, flush_context, instances):
    try:
        with session.no_autoflush:
            for obj in list(session.new) + list(session.dirty):
                if isinstance(obj, Conversation):
                    sincronizar(obj)
    except Exception as e:
        # La conversación se guarda igual, sin persona.
        logger.error(f'[CONVERSACION] No se pudo sincronizar la persona: {e}')


def registrar():
    """Engancha la sincronización a la sesión (una sola vez)."""
    if not _estado['registrado']:
        event.listen(db.session, 'before_flush', _al_guardar)
        _estado['registrado'] = True
