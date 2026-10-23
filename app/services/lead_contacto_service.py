"""Quién es un lead de ManyChat (Etapa 2c, parte 7, docs/plan_personas.md).

«Quién es» sale de la persona (su identidad de Instagram) y su conversación; `ManychatLead` queda
como el registro del canal (manychat_id, follower, setter, last_stage). Su `ig` y su `name` son el
respaldo: se leen cuando no hay persona (o la persona no tiene ese dato), y desde acá.

  · `contacto(lead)` / `contactos(leads)`: el nombre y el instagram del lead, de su persona.
  · `lead_por_ig(ig, nombre=None)`: el lead de alguien por su instagram: el de la persona que lo
    tiene y, si no hay, el respaldo de siempre: el primero con ese instagram en la fila (o, sin
    instagram, con ese nombre).
  · `IG_NORMALIZADO`, `NOMBRE_NORMALIZADO`, `sin_persona(...)`: la copia en SQL.

`ig` y `name` no se borran (21/10/2026): son el dato crudo del canal. El respaldo por la fila se
conserva tal cual, porque la atribución de anuncios depende de él.
"""
from sqlalchemy import and_, func, or_

from app.models import ManychatLead, Person

IG_NORMALIZADO = func.lower(func.replace(ManychatLead.ig, '@', ''))
NOMBRE_NORMALIZADO = func.lower(ManychatLead.name)


def ig_limpio(valor):
    v = (valor or '').strip().lstrip('@').lower()
    return v if v and v != 'n/a' else None


def sin_persona(*condiciones):
    """Las condiciones sobre la copia del lead, solo para leads sin persona. None si no hay ninguna."""
    condiciones = [c for c in condiciones if c is not None]
    if not condiciones:
        return None
    return and_(ManychatLead.person_uuid.is_(None), or_(*condiciones))


def _de(lead, person):
    if person is None:
        return {'nombre': lead.name, 'ig': lead.ig}
    return {'nombre': person.full_name or lead.name, 'ig': person.instagram or lead.ig}


def contacto(lead):
    """{'nombre', 'ig'} del lead: los de su persona (los de la fila si la persona no los tiene) o,
    sin persona, los de la fila."""
    person = lead.person if lead.person_uuid else None
    return _de(lead, person)


def contactos(leads):
    """{id del lead: contacto()} de una tanda, con sus personas en una consulta por cada 500."""
    uuids = sorted({l.person_uuid for l in leads if l.person_uuid})
    personas = {}
    for i in range(0, len(uuids), 500):
        personas.update({p.uuid: p for p in Person.query.filter(Person.uuid.in_(uuids[i:i + 500])).all()})
    return {l.id: _de(l, personas.get(l.person_uuid)) for l in leads}


def lead_por_ig(ig, nombre=None):
    """El `ManychatLead` de quien tiene ese instagram: el de su persona y, si no hay, el primero con
    ese instagram en la fila (el respaldo de siempre) y, si tampoco, el primero con ese nombre exacto.
    None si no hay."""
    from app.services import conversaciones_service, person_service

    ig = ig_limpio(ig)
    if ig:
        person = person_service.buscar(instagram=ig)
        lead = conversaciones_service.lead_de_persona(person.uuid) if person else None
        if lead is not None:
            return lead
        lead = ManychatLead.query.filter(IG_NORMALIZADO == ig).first()
        if lead is not None:
            return lead
    nombre = (nombre or '').strip().lower()
    if nombre:
        return ManychatLead.query.filter(NOMBRE_NORMALIZADO == nombre).first()
    return None
