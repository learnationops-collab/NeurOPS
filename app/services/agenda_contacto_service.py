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


# La copia de la agenda en SQL, para consultas en lote: es el único lugar que nombra las columnas
# fuera del modelo (Etapa 2c). Solo se usan sobre agendas sin persona (`sin_persona`).
LEAD = FinancialAgenda.lead
MAIL = FinancialAgenda.mail
INSTAGRAM = FinancialAgenda.instagram
WHATSAPP = FinancialAgenda.whatsapp
MAIL_NORMALIZADO = func.lower(FinancialAgenda.mail)
IG_NORMALIZADO = func.lower(func.replace(FinancialAgenda.instagram, '@', ''))


def whatsapp_solo_digitos(separadores=(' ', '-', '(', ')', '+', '.')):
    """El whatsapp de la copia sin separadores, para comparar números y no textos."""
    columna = WHATSAPP
    for sep in separadores:
        columna = func.replace(columna, sep, '')
    return columna


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
        IG_NORMALIZADO == ig if ig else None,
        MAIL_NORMALIZADO == mail if mail else None,
        WHATSAPP.like(f'%{tel}%') if tel else None)
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
        sin_persona(LEAD.ilike(patron), MAIL.ilike(patron), INSTAGRAM.ilike(patron), WHATSAPP.ilike(patron)))


def precargar(agendas):
    """Carga en la sesión las personas de estas agendas (una consulta cada 500)."""
    uuids = sorted({a.person_uuid for a in agendas if a.person_uuid})
    for i in range(0, len(uuids), 500):
        Person.query.filter(Person.uuid.in_(uuids[i:i + 500])).all()
    return agendas



def dar_persona(agenda, nombre=None, mail=None, instagram=None, telefono=None):
    """La persona de una agenda que entra (Etapa 2c), resuelta con los datos que llegaron y no con la
    copia de la agenda: si ya la tiene, se le anotan los datos nuevos; si no, se busca o se crea.
    Sin ningún dato no se sabe quién es y queda sin persona. Hace flush (`person_service.resolver`)."""
    from app.services import person_service

    datos = dict(email=mail, instagram=instagram, phone=telefono)
    # Una agenda nueva con `person_uuid` todavía no carga la relación: se la busca.
    person = agenda.person or (person_service.por_uuid(agenda.person_uuid) if agenda.person_uuid else None)
    if person is not None:
        person_service.anotar(person, person_service.claves(**datos), 'agenda')
        return person
    if not person_service.claves(**datos):
        return None
    agenda.person = person_service.resolver(nombre, **datos, fuente='agenda')
    return agenda.person


def corregir(agenda, campo, valor, usuario=None):
    """Editar el lead, mail, whatsapp o instagram de una agenda (Etapa 2c): con persona, se corrige la
    persona (nuevo principal y el anterior dado de baja, como la ficha), que es de donde se lee; la
    copia de la agenda ya no se toca. Sin persona, se escribe en la copia. Un valor vacío no cambia
    nada; uno inválido es ValueError y uno que ya es de otra persona, `DatoDeOtraPersona`. No hace commit."""
    from app.services import person_service
    from app.services.persona_de_venta import DatoDeOtraPersona

    p = agenda.person if agenda.person_uuid else None
    if p is None:
        setattr(agenda, campo, valor)
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
