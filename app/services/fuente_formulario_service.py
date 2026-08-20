"""La fuente de una agenda sale del formulario de Calendly, no del evento.

Desde el 20/08/2026 entraron setters nuevos (Elias, Paula, Ivan) y cada uno tiene
su propio formulario de Calendly, pero **todos apuntan al mismo evento**. Eso
significa que el webhook de agendas de n8n llega siempre con la misma fuente
(hoy 'Elias'), sin importar quien haya traido al lead: el unico dato que
distingue a un setter de otro es el `fuente_form` del formulario.

Por eso el formulario manda sobre la agenda. Este modulo hace de puente entre los
dos, en los dos ordenes de llegada posibles (no hay garantia de cual entra
primero, son dos webhooks independientes):

  1. Llega la AGENDA y despues el FORMULARIO
     -> `aplicar_a_agendas_del_cliente()` reescribe la fuente de la agenda ya
        creada (lo llama `receive_financial_agendas_form`).

  2. Llega el FORMULARIO y despues la AGENDA
     -> `fuente_para_agenda_entrante()` pisa la fuente del webhook con la del
        formulario antes de guardar (lo llama `receive_financial_agendas`).

Solo actua cuando el `fuente_form` corresponde a un **setter real y activo**: si
dice 'workshop', 'workshop landing' o cualquier otra cosa, no se toca nada — esas
fuentes son embudos, no personas, y las clasifica `fuente_service`.
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy import or_, func

from app import db
from app.models import Client, FinancialAgenda, Appointment, User
from app.services.fuente_service import normalizar, fuente_canonica

logger = logging.getLogger(__name__)

# Ventana alrededor del alta de la agenda dentro de la cual un formulario se
# considera "de esa agenda". El formulario se completa en el mismo acto de
# agendar, asi que en la practica llegan con segundos de diferencia; los 3 dias
# son colchon para reintentos de n8n y desfases de zona horaria, no un criterio.
DIAS_VENTANA_VINCULO = 3

# Marca en raw_data para poder auditar de donde salio la fuente de una agenda.
ORIGEN_FORMULARIO = 'formulario_calendly'


def resolver_setter(texto):
    """Devuelve el User setter que corresponde a `texto`, o None.

    Comparacion normalizada (sin acentos ni mayusculas) y **exacta** contra el
    username. A proposito no se usa `BookingService.resolve_user_by_name`, que
    hace match parcial: aca un falso positivo le atribuiria la agenda al setter
    equivocado, y es preferible no tocar nada antes que asignar mal.
    """
    objetivo = normalizar(texto)
    if not objetivo:
        return None
    for u in User.query.filter_by(role='setter').all():
        if normalizar(u.username) == objetivo:
            return u
    return None


def valor_de_fuente(fuente_form):
    """Que hay que escribir en la agenda para este `fuente_form`, o None.

    El formulario de Calendly manda una de estas siete (20/08/2026):
    Workshop · VSL · Paula · Ivan · Elias · workshop landing · No identificado.

    Las tres del medio son personas y se escriben con el username del setter; las
    otras tres son embudos y se normalizan al vocabulario del webhook de agendas
    ('workshop', 'vsl', 'workshop_landing'). 'No identificado' devuelve None: es
    justamente el caso que deja la agenda sin dueño para que la reclame un setter.
    """
    setter = resolver_setter(fuente_form)
    if setter:
        return setter.username
    return fuente_canonica(fuente_form)


def _limpiar(valor, invalidos=('n/a', 'none', 'null', '')):
    if valor is None:
        return None
    v = str(valor).strip()
    return v if v and v.lower() not in invalidos else None


def condiciones_de_identidad(campos):
    """Condiciones OR para reconocer a la misma persona en una tabla.

    `campos` es un dict con las claves que existan de: instagram, mail, telefono,
    nombre. Se comparan normalizando (sin arroba, en minusculas) y el telefono
    por sus ultimos 8 digitos, que es lo unico estable entre los distintos
    formatos con y sin prefijo de pais que llegan de Calendly y de ManyChat.
    """
    condiciones = []

    ig = _limpiar(campos.get('instagram'))
    if ig:
        ig = ig.lstrip('@').lower()
        condiciones.append(func.lower(func.replace(campos['col_instagram'], '@', '')) == ig)

    mail = _limpiar(campos.get('mail'))
    if mail and '@' in mail:
        condiciones.append(func.lower(campos['col_mail']) == mail.lower())

    telefono = _limpiar(campos.get('telefono'))
    if telefono:
        digitos = ''.join(c for c in telefono if c.isdigit())
        if len(digitos) >= 8:
            condiciones.append(campos['col_telefono'].like(f"%{digitos[-8:]}%"))

    nombre = _limpiar(campos.get('nombre'))
    if nombre and len(nombre) > 3:
        condiciones.append(func.lower(campos['col_nombre']) == nombre.lower())

    return condiciones


def _condiciones_agenda(nombre=None, telefono=None, instagram=None, mail=None):
    return condiciones_de_identidad({
        'instagram': instagram, 'col_instagram': FinancialAgenda.instagram,
        'mail': mail, 'col_mail': FinancialAgenda.mail,
        'telefono': telefono, 'col_telefono': FinancialAgenda.whatsapp,
        'nombre': nombre, 'col_nombre': FinancialAgenda.lead,
    })


def _condiciones_cliente(nombre=None, telefono=None, instagram=None, mail=None):
    return condiciones_de_identidad({
        'instagram': instagram, 'col_instagram': Client.instagram,
        'mail': mail, 'col_mail': Client.email,
        'telefono': telefono, 'col_telefono': Client.phone,
        'nombre': nombre, 'col_nombre': Client.full_name,
    })


def fuente_del_cliente(nombre=None, telefono=None, instagram=None, mail=None):
    """Fuente segun el formulario que completo esta persona, o None.

    Se usa cuando la agenda llega DESPUES del formulario: los datos del
    formulario ya quedaron guardados en `Client.form_data`.
    """
    condiciones = _condiciones_cliente(nombre, telefono, instagram, mail)
    if not condiciones:
        return None

    clientes = Client.query.filter(or_(*condiciones)).order_by(Client.created_at.desc()).limit(5).all()
    for c in clientes:
        fd = c.form_data or {}
        valor = valor_de_fuente(fd.get('fuente_form') or fd.get('fuente'))
        if valor:
            return valor
    return None


def fuente_para_agenda_entrante(fuente_webhook, nombre=None, telefono=None, instagram=None, mail=None):
    """Fuente definitiva para una agenda que esta entrando por el webhook.

    Devuelve la del formulario si esa persona ya completo uno de un setter; si
    no, la que trajo el webhook tal cual.
    """
    try:
        del_formulario = fuente_del_cliente(nombre=nombre, telefono=telefono,
                                            instagram=instagram, mail=mail)
    except Exception as e:
        logger.error(f"[FUENTE FORM] No se pudo resolver la fuente del formulario: {e}")
        return fuente_webhook, False

    if del_formulario and normalizar(del_formulario) != normalizar(fuente_webhook):
        return del_formulario, True
    return fuente_webhook, False


def _propagar_a_cita(agenda, setter=None):
    """Deja la cita asociada apuntando al setter dueño de la agenda.

    `setter` es None cuando la fuente es un embudo (workshop, vsl, ...): en ese
    caso la agenda no es de nadie del equipo de setting y la cita se desatribuye.

    `Appointment.setter_id` es lo que decide que agendas ve cada setter en su
    espacio de trabajo, y `origin` es de donde el sync inverso recupera la fuente.
    """
    condiciones = []
    ig = _limpiar(agenda.instagram)
    if ig:
        condiciones.append(func.lower(func.replace(Client.instagram, '@', '')) == ig.lstrip('@').lower())
    mail = _limpiar(agenda.mail)
    if mail and '@' in mail:
        condiciones.append(func.lower(Client.email) == mail.lower())
    if not condiciones or not agenda.date:
        return False

    client = Client.query.filter(or_(*condiciones)).first()
    if not client:
        return False

    appt = Appointment.query.filter(
        Appointment.client_id == client.id,
        Appointment.start_time >= agenda.date - timedelta(hours=12),
        Appointment.start_time <= agenda.date + timedelta(hours=12)
    ).first()
    if not appt:
        return False

    appt.origin = agenda.nombre or appt.origin
    appt.setter_id = setter.id if setter else None
    db.session.add(appt)
    return True


def aplicar_a_agendas_del_cliente(fuente_form, nombre=None, telefono=None,
                                  instagram=None, mail=None, referencia=None):
    """Reescribe la fuente de la(s) agenda(s) de esta persona con la del formulario.

    Se usa cuando el formulario llega DESPUES de la agenda. `referencia` es el
    momento contra el que se mide la ventana de vinculo (por defecto, ahora).

    Devuelve (nombre_del_setter, cantidad_de_agendas_actualizadas) o (None, 0) si
    la fuente del formulario no es un setter o no se encontro a la persona.
    """
    valor = valor_de_fuente(fuente_form)
    if not valor:
        return None, 0
    setter = resolver_setter(fuente_form)

    condiciones = _condiciones_agenda(nombre, telefono, instagram, mail)
    if not condiciones:
        return None, 0

    referencia = referencia or datetime.utcnow()
    desde = referencia - timedelta(days=DIAS_VENTANA_VINCULO)
    hasta = referencia + timedelta(days=DIAS_VENTANA_VINCULO)

    agendas = FinancialAgenda.query.filter(
        or_(*condiciones),
        FinancialAgenda.created_at >= desde,
        FinancialAgenda.created_at <= hasta
    ).order_by(FinancialAgenda.created_at.desc()).all()

    actualizadas = 0
    for agenda in agendas:
        if normalizar(agenda.nombre) == normalizar(valor):
            continue
        agenda.nombre = valor
        raw = dict(agenda.raw_data or {})
        raw['fuente_webhook'] = raw.get('fuente_webhook', raw.get('fuente'))
        raw['fuente_origen'] = ORIGEN_FORMULARIO
        raw['fuente_form'] = fuente_form
        agenda.raw_data = raw
        db.session.add(agenda)
        try:
            _propagar_a_cita(agenda, setter)
        except Exception as e:
            logger.error(f"[FUENTE FORM] No se pudo propagar a la cita de la agenda {agenda.id}: {e}")
        actualizadas += 1

    return valor, actualizadas
