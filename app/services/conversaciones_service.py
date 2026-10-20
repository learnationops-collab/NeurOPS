"""Las conversaciones (20/10/2026, frente B de docs/plan_personas.md): cada lead de ManyChat queda con su
persona y su `Conversation`.

Mientras dura la transición los leads se siguen escribiendo como siempre (`ManychatLead` + `LeadAnswer`,
y el `Lead` viejo de /api/webhooks/manychat): este módulo los sigue en `before_flush`, así cualquiera que
los escriba (el webhook, el motor de Instagram, el setter, Marketing) deja también la persona y la
conversación, sin tocar cada camino.

  · La persona: el `manychat_id` de ManyChat (solo dígitos) alcanza para encontrarla o crearla. Los
    leads armados a mano (`synth_`, `manual_`, la marca de `palabra_clave_service`) solo se vinculan a
    una que ya exista, por Instagram y nombre compatible: crearla ahí duplicaría al cliente.
  · La conversación: una por persona y anuncio, como `manychat_ad_leads`. La clave es el canal, el id
    externo (el manychat_id, o el IGSID del motor) y el anuncio o, si no hay, la palabra clave. Un
    mensaje sin anuncio ni palabra clave va a la última conversación de ese id.
"""
import logging
from datetime import datetime
from uuid import uuid4

from sqlalchemy import event

from app import db
from app.models import Conversation, Lead, LeadAnswer, ManychatLead, Person
from app.models.marketing import clave_de_palabra
from app.services import person_service

logger = logging.getLogger(__name__)

PREFIJO_INSTAGRAM = 'ig:'  # el motor propio de Instagram (`automatizaciones/registro.py`)
CALIFICACIONES = ('true', 'false')
_estado = {'registrado': False, 'pausado': False}


def canal_de(manychat_id):
    """(canal, id externo) de un manychat_id."""
    mid = str(manychat_id or '').strip()
    if mid.startswith(PREFIJO_INSTAGRAM):
        return 'instagram', mid[len(PREFIJO_INSTAGRAM):]
    return 'manychat', mid


def manychat_id_real(manychat_id):
    """El id de ManyChat si es uno de verdad (solo dígitos); los armados a mano llevan prefijo."""
    mid = str(manychat_id or '').strip()
    return mid if mid.isdigit() else None


def persona_de(nombre, *, crear, fuente='manychat', actual_uuid=None, **datos):
    """La persona de un lead, sin flush (sirve dentro de `before_flush`). Le anota los datos que traiga."""
    pares = person_service.claves(**datos)
    person = person_service.por_uuid(actual_uuid) if actual_uuid else None
    if person is None:
        person = person_service.buscar(nombre, **datos)
    if person is None:
        if not crear or not pares:
            return None
        phone = datos.get('phone')
        person = Person(uuid=str(uuid4()), full_name=nombre or None, phone=str(phone).strip() if person_service.normalizar('phone', phone) else None)
        db.session.add(person)
    elif nombre and not person.full_name:
        person.full_name = nombre
    if pares:
        person_service.anotar(person, pares, fuente)
    return person


def _pendientes(canal, externo):
    return [o for o in db.session.new if isinstance(o, Conversation) and o.channel == canal and o.external_id == externo]


def conversacion_de(canal, externo, ad_id=None, keyword=None):
    """La conversación de ese id y anuncio (o palabra clave); None si todavía no hay."""
    clave = clave_de_palabra(keyword)
    candidatas = _pendientes(canal, externo) + Conversation.query.filter_by(channel=canal, external_id=externo) \
        .order_by(Conversation.created_at.desc(), Conversation.id.desc()).all()
    if ad_id:
        por_anuncio = next((c for c in candidatas if c.ad_id == ad_id), None)
        if por_anuncio:
            return por_anuncio
    if clave:
        return next((c for c in candidatas if not c.ad_id and clave_de_palabra(c.keyword) == clave), None)
    return None if ad_id else (candidatas[0] if candidatas else None)


def _guardar_conversacion(canal, externo, person, ad_id=None, keyword=None, creada=None, **campos):
    creada = creada if isinstance(creada, datetime) else None  # puede venir `func.now()`
    conv = conversacion_de(canal, externo, ad_id, keyword)
    if conv is None:
        conv = Conversation(channel=canal, external_id=externo, ad_id=ad_id, keyword=keyword)
        if creada:  # sin fecha, la del default al insertar
            conv.created_at = creada
        db.session.add(conv)
    if ad_id and not conv.ad_id:
        conv.ad_id = ad_id
    if keyword and not conv.keyword:
        conv.keyword = keyword
    if creada and conv.created_at and creada < conv.created_at:
        conv.created_at = creada
    if person is not None:
        conv.person = person
    for campo, valor in campos.items():
        if campo == 'data':
            conv.data = {**(conv.data or {}), **{k: v for k, v in valor.items() if v is not None}}
        elif valor is not None:
            setattr(conv, campo, valor)
    return conv


def sincronizar_lead(lead):
    """La persona del `ManychatLead` y lo que es suyo en sus conversaciones (setter, etapa)."""
    canal, externo = canal_de(lead.manychat_id)
    if not externo:
        return None
    real = manychat_id_real(lead.manychat_id)
    person = persona_de(lead.name, crear=bool(real) or canal == 'instagram', actual_uuid=lead.person_uuid,
                        instagram=lead.ig, manychat_id=real)
    if person is not None:
        lead.person = person
    comunes = {'setter': lead.setter, 'stage': str(lead.last_stage) if lead.last_stage is not None else None,
               'data': {'manychat_lead_id': lead.id, 'follower': lead.follower}}
    convs = _pendientes(canal, externo) + Conversation.query.filter_by(channel=canal, external_id=externo).all()
    for conv in convs:
        if person is not None:
            conv.person = person
        conv.data = {**(conv.data or {}), **{k: v for k, v in comunes['data'].items() if v is not None}}
        for campo in ('setter', 'stage'):
            if comunes[campo] is not None:
                setattr(conv, campo, comunes[campo])
    return person


def sincronizar_respuesta(answer, lead=None):
    """La conversación de una `LeadAnswer`: su anuncio, su palabra clave y la calificación."""
    lead = lead or answer.__dict__.get('lead') or (db.session.get(ManychatLead, answer.lead_id) if answer.lead_id else None)
    if lead is None or not lead.manychat_id:
        return None
    canal, externo = canal_de(lead.manychat_id)
    person = lead.person or (person_service.por_uuid(lead.person_uuid) if lead.person_uuid else None)
    calif = answer.qualification if answer.qualification in CALIFICACIONES else None
    return _guardar_conversacion(
        canal, externo, person, ad_id=answer.ad_id, keyword=answer.keyword, creada=answer.created_at,
        qualification=calif, setter=lead.setter,
        stage=str(lead.last_stage) if lead.last_stage is not None else None,
        data={'manychat_lead_id': lead.id, 'follower': lead.follower})


def sincronizar_lead_viejo(lead):
    """El `Lead` de /api/webhooks/manychat: su persona y una conversación por su palabra clave."""
    canal, externo = canal_de(lead.manychat_id)
    if not externo:
        return None
    real = manychat_id_real(lead.manychat_id)
    person = persona_de(lead.name, crear=bool(real), actual_uuid=lead.person_uuid, email=lead.email,
                        instagram=lead.instagram_username, manychat_id=real)
    if person is not None:
        lead.person = person
    etapa = lead.stage.name if lead.stage_id and lead.stage else (str(lead.last_stage) if lead.last_stage is not None else None)
    return _guardar_conversacion(canal, externo, person, keyword=lead.ad_source, creada=lead.created_at, stage=etapa,
                                 data={'lead_id': lead.id, 'funnel_step': lead.funnel_step, 'tags': lead.tags,
                                       'notes': lead.notes})


def cliente_del_lead(lead):
    """El cliente del lead: el de su persona y, si no tiene, el de su Instagram. Si no hay ninguno lo
    crea (con su persona, si ya la tiene). No hace commit."""
    from sqlalchemy import func
    from app.models import Client

    person = person_service.por_uuid(lead.person_uuid) if lead.person_uuid else None
    client = person_service.cliente_de(person, crear=False)
    if client is not None:
        return client
    ig = (lead.ig or '').strip().replace('@', '').lower()
    if ig:
        client = Client.query.filter(func.lower(func.replace(Client.instagram, '@', '')) == ig).first()
    if client is None and person is not None:
        client = person_service.cliente_de(person)
    if client is None:
        client = Client(full_name=lead.name or 'Sin Nombre', instagram=lead.ig, created_at=datetime.utcnow())
        db.session.add(client)
    return client


def _al_guardar(session, flush_context, instances):
    if _estado['pausado']:
        return
    try:
        with session.no_autoflush:
            cambiados = list(session.new) + list(session.dirty)
            for obj in cambiados:
                if isinstance(obj, ManychatLead):
                    sincronizar_lead(obj)
                elif isinstance(obj, Lead):
                    sincronizar_lead_viejo(obj)
            for obj in cambiados:
                if isinstance(obj, LeadAnswer):
                    sincronizar_respuesta(obj)
    except Exception as e:
        # El lead se guarda igual: la conversación que faltó la recupera scripts/migrar_conversaciones.py.
        logger.error(f'[CONVERSACION] No se pudo sincronizar: {e}')


def registrar():
    """Engancha la sincronización a la sesión (una sola vez)."""
    if not _estado['registrado']:
        event.listen(db.session, 'before_flush', _al_guardar)
        _estado['registrado'] = True


class pausado:
    """Apaga la sincronización automática (el script de migración la hace a mano)."""

    def __enter__(self):
        _estado['pausado'] = True

    def __exit__(self, *exc):
        _estado['pausado'] = False
