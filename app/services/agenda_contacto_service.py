"""Quién es el lead de una agenda (Etapa 2b de docs/plan_personas.md, frente K).

El nombre, mail, whatsapp e instagram copiados en `financial_agendas` se leen solo en agendas sin
persona; las demás se leen de su persona (`FinancialAgenda.contacto()`). Las columnas se siguen
escribiendo hasta la Etapa 2c, donde se borran.

  · `filtro(person_uuid, instagram=, mail=, telefono=)`: las agendas de alguien. Las de su persona y,
    por la copia, solo las que no tienen persona.
  · `busqueda(patron)`: el buscador por texto (nombre, mail, instagram, teléfono): en la persona y
    sus otros datos válidos, y en la copia de las agendas sin persona.
  · `precargar(agendas)`: trae las personas de un listado en una consulta, para que `contacto()` no
    haga una por fila.
"""
import logging

from sqlalchemy import func, or_, and_, select

from app.models import Person, PersonIdentity
from app.models.financial import FinancialAgenda

logger = logging.getLogger(__name__)


def ig_limpio(valor):
    v = (valor or '').strip().replace('@', '').lower()
    return v if v and v != 'n/a' else None


def mail_limpio(valor):
    v = (valor or '').strip().lower()
    return v if v and v != 'n/a' else None


def sin_persona(*condiciones):
    """Las condiciones sobre la copia, solo para agendas sin persona. None si no hay ninguna."""
    condiciones = [c for c in condiciones if c is not None]
    if not condiciones:
        return None
    return and_(FinancialAgenda.person_uuid.is_(None), or_(*condiciones))


def filtro(person_uuid=None, instagram=None, mail=None, telefono=None):
    """La condición de «las agendas de esta persona», o None si no hay con qué buscar."""
    ig, mail = ig_limpio(instagram), mail_limpio(mail)
    tel = (telefono or '').strip()
    copia = sin_persona(
        func.lower(func.replace(FinancialAgenda.instagram, '@', '')) == ig if ig else None,
        func.lower(FinancialAgenda.mail) == mail if mail else None,
        FinancialAgenda.whatsapp.like(f'%{tel}%') if tel else None)
    partes = [c for c in (FinancialAgenda.person_uuid == person_uuid if person_uuid else None, copia) if c is not None]
    return or_(*partes) if partes else None


def busqueda(patron):
    """Agendas cuyo lead coincide con el patrón (`ilike`) por nombre, mail, instagram o teléfono."""
    de_persona = select(Person.uuid).where(or_(
        Person.full_name.ilike(patron), Person.email.ilike(patron),
        Person.instagram.ilike(patron), Person.phone.ilike(patron)))
    de_identidad = select(PersonIdentity.person_uuid).where(
        PersonIdentity.retired_at.is_(None), PersonIdentity.value.ilike(patron))
    return or_(
        FinancialAgenda.person_uuid.in_(de_persona), FinancialAgenda.person_uuid.in_(de_identidad),
        sin_persona(FinancialAgenda.lead.ilike(patron), FinancialAgenda.mail.ilike(patron),
                    FinancialAgenda.instagram.ilike(patron), FinancialAgenda.whatsapp.ilike(patron)))


def precargar(agendas):
    """Carga en la sesión las personas de estas agendas (una consulta cada 500)."""
    uuids = sorted({a.person_uuid for a in agendas if a.person_uuid})
    for i in range(0, len(uuids), 500):
        Person.query.filter(Person.uuid.in_(uuids[i:i + 500])).all()
    return agendas



def corregir(agenda, campo, valor, usuario=None):
    """Editar el lead, mail, whatsapp o instagram de una agenda: se escribe en la copia y, si tiene
    persona, la corrige (nuevo principal y el anterior dado de baja, como la ficha), porque lo que se
    muestra sale de la persona. Un valor vacío o inválido solo cambia la copia; uno que ya es de otra
    persona también (queda en el log). No hace commit."""
    from app.services import person_service

    setattr(agenda, campo, valor)
    p = agenda.person if agenda.person_uuid else None
    if p is None:
        return
    if campo == 'lead':
        p.full_name = person_service.nombre_limpio(valor) or p.full_name
        return
    kind = {'mail': 'email', 'whatsapp': 'phone', 'instagram': 'instagram'}[campo]
    nuevo = person_service.normalizar(kind, valor)
    if not nuevo or nuevo == person_service.normalizar(kind, getattr(p, kind)):
        return
    otros = set(person_service.duenos(kind, nuevo)) - {p.uuid}
    if otros:
        logger.warning(f'[AGENDA] {kind} de la agenda #{agenda.id} ya es de otra persona ({sorted(otros)}): no se corrige la persona')
        return
    person_service.hacer_principal(p, kind, valor, usuario, reason='tablero de agendas', corrige=True)
