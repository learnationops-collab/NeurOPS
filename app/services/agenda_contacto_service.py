"""Quién es el lead de una agenda (frente K y Etapa 2c de docs/plan_personas.md).

La agenda no guarda el contacto (21/10/2026): el nombre, mail, whatsapp e instagram son de su persona
(`FinancialAgenda.contacto()`), y toda agenda tiene una desde que entra (`dar_persona`).

  · `dar_persona(agenda, nombre, mail, instagram, telefono)`: la persona de una agenda que entra,
    con los datos que llegaron. Es la única vía: el hook de `person_service` ya no mira agendas.
  · `filtro(person_uuid)`: las agendas de alguien, las de su persona.
  · `busqueda(patron)`: el buscador por texto (nombre, mail, instagram, teléfono), en la persona y
    sus otros datos válidos.
  · `precargar(agendas)`: trae las personas de un listado en una consulta, para que `contacto()` no
    haga una por fila.
  · `corregir(agenda, campo, valor)`: editar el contacto de una agenda es corregir a su persona.
"""
import logging
from uuid import uuid4

from sqlalchemy import or_, select

from app import db
from app.models import Person, PersonIdentity
from app.models.financial import FinancialAgenda

logger = logging.getLogger(__name__)


def ig_limpio(valor):
    v = (valor or '').strip().replace('@', '').lower()
    return v if v and v != 'n/a' else None


def mail_limpio(valor):
    v = (valor or '').strip().lower()
    return v if v and v != 'n/a' else None


def filtro(person_uuid=None, **_):
    """La condición de «las agendas de esta persona», o None si no hay persona. Los datos sueltos que
    reciben los que llamaban antes (instagram, mail, telefono) ya no cuentan: la agenda no los guarda."""
    return FinancialAgenda.person_uuid == person_uuid if person_uuid else None


def busqueda(patron):
    """Agendas cuyo lead coincide con el patrón (`ilike`) por nombre, mail, instagram o teléfono."""
    de_persona = select(Person.uuid).where(or_(
        Person.full_name.ilike(patron), Person.email.ilike(patron),
        Person.instagram.ilike(patron), Person.phone.ilike(patron)))
    de_identidad = select(PersonIdentity.person_uuid).where(
        PersonIdentity.retired_at.is_(None), PersonIdentity.value.ilike(patron))
    return or_(FinancialAgenda.person_uuid.in_(de_persona), FinancialAgenda.person_uuid.in_(de_identidad))


def precargar(agendas):
    """Carga en la sesión las personas de estas agendas (una consulta cada 500)."""
    uuids = sorted({a.person_uuid for a in agendas if a.person_uuid})
    for i in range(0, len(uuids), 500):
        Person.query.filter(Person.uuid.in_(uuids[i:i + 500])).all()
    return agendas


def dar_persona(agenda, nombre=None, mail=None, instagram=None, telefono=None):
    """La persona de una agenda que entra, resuelta con los datos que llegaron: si ya la tiene, se le
    anotan los nuevos; si no, se busca o se crea. Sin ningún dato de contacto válido se crea una persona
    solo con el nombre (no se busca por nombre: dos personas pueden llamarse igual). Ninguna agenda
    queda sin persona. Hace flush (`person_service.resolver`)."""
    from app.services import person_service

    datos = dict(email=mail, instagram=instagram, phone=telefono)
    # Una agenda nueva con `person_uuid` todavía no carga la relación: se la busca.
    person = agenda.person or (person_service.por_uuid(agenda.person_uuid) if agenda.person_uuid else None)
    if person is not None:
        person_service.anotar(person, person_service.claves(**datos), 'agenda')
        return person
    if person_service.claves(**datos):
        agenda.person = person_service.resolver(nombre, **datos, fuente='agenda')
    else:
        agenda.person = Person(uuid=str(uuid4()), full_name=person_service.nombre_limpio(nombre) or None)
        db.session.add(agenda.person)
    return agenda.person


def corregir(agenda, campo, valor, usuario=None):
    """Editar el lead, mail, whatsapp o instagram de una agenda es corregir a su persona (nuevo principal
    y el anterior dado de baja, como la ficha). Una agenda sin persona la recibe con ese dato. Un valor
    vacío no cambia nada; uno inválido es ValueError y uno que ya es de otra persona, `DatoDeOtraPersona`.
    No hace commit."""
    from app.services import person_service
    from app.services.persona_de_venta import DatoDeOtraPersona

    p = agenda.person if agenda.person_uuid else None
    if p is None:
        dato = {'mail': 'mail', 'whatsapp': 'telefono', 'instagram': 'instagram'}.get(campo)
        dar_persona(agenda, valor if campo == 'lead' else None, **({dato: valor} if dato else {}))
        return
    if campo == 'lead':
        p.full_name = person_service.nombre_limpio(valor) or p.full_name
        return
    kind, etiqueta = {'mail': ('email', 'mail'), 'whatsapp': ('phone', 'whatsapp'),
                      'instagram': ('instagram', 'instagram')}[campo]
    if not str(valor or '').strip():
        return
    nuevo = person_service.normalizar(kind, valor)
    if not nuevo:
        raise ValueError(f'El {etiqueta} «{valor}» no es válido.')
    if nuevo == person_service.normalizar(kind, getattr(p, kind)):
        return
    otros = set(person_service.duenos(kind, nuevo)) - {p.uuid}
    if otros:
        raise DatoDeOtraPersona(f'El {etiqueta} «{valor}» ya es de otra persona: corregilo desde su ficha.')
    person_service.hacer_principal(p, kind, valor, usuario, reason='tablero de agendas', corrige=True)
