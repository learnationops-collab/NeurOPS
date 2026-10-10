"""Qué leads son de un setter: los únicos cuya ficha puede abrir.

Desde el 10/10/2026 el setter tiene su Revisar (sus agendas, sus ventas y sus leads) y de cada fila
abre la ficha del lead. Hasta ese día `GET /api/ficha/lead` y `GET /api/comercial/clientes/<id>` le
abrían a un setter CUALQUIER lead o cliente, con sus pagos y su deuda (pendiente anotado el
01/10/2026). Ahora solo los suyos; lo demás es un 404, no un 403, como el resto de lo que queda
fuera de alcance (un 403 confirmaría que existe).

"Suyo" es todo lo que alguna de sus listas le puede mostrar, con las reglas con las que se arman:

  1. una agenda que generó él (`Appointment.setter_id`): sus agendas generadas;
  2. una agenda cuya FUENTE es él (`Appointment.origin` con su nombre): el lápiz de la ficha escribe
     la fuente ahí y en el Tablero (`ficha_agendas_service.poner_fuente`), y las agendas viejas de un
     setter (junio-julio de 2026) quedaron con la fuente y sin `setter_id`;
  3. una fila del Tablero de Agendas con su nombre (`FinancialAgenda.nombre`, lo que lee «Mis
     agendas») con el Instagram o el correo de esa persona o de sus pagos: es la agenda con la que
     la atribución le da una venta (`AttributionService` une agendas y pagos por esos dos datos);
  4. un pago de esa persona con su nombre escrito como setter: la fuente de una venta sin agenda,
     la misma regla de la nómina (`nomina_service.setter_de_la_venta`).

Con 3 y 4 entran todos los cobros de su Revisar › Ventas (los de «Setting · <setter>», ver
`ComercialService.de_la_fuente_del_setter`). El cruce es por persona, no por período: una persona
que agendó con él la puede abrir siempre, también después de comprar por otra vía. Los leads de
ManyChat sin cliente no pasan por acá: su fila no tiene ficha.

Se compara el nombre normalizado (`fuente_service.normalizar`): la fuente la escriben n8n, el
formulario y ediciones a mano, y conviven 'Ivan' e 'Iván'.
"""
from sqlalchemy import func, or_

from app import db
from app.models import Appointment, Client, FinancialAgenda
from app.services.fuente_service import normalizar


def _ig(valor):
    v = (valor or '').strip().lstrip('@').lower()
    return v if v and v != 'n/a' else None


def _mail(valor):
    v = (valor or '').strip().lower()
    return v if v and '@' in v and v != 'n/a' else None


def _ventas_de(client):
    """Los pagos de esta persona, por el mismo cruce de contacto que usa la ficha."""
    from app.services.ficha_lead_service import _ventas_del_cliente
    return _ventas_del_cliente(client)


def es_lead_del_setter(setter, appt=None, client=None):
    """¿`setter` puede abrir el lead de `appt` (una agenda) o de `client`? Ver el docstring del
    módulo. Sin ninguna de las dos, o sin un setter con nombre, no."""
    if setter is None or getattr(setter, 'id', None) is None:
        return False
    if appt is not None and appt.setter_id == setter.id:
        return True
    if client is None and appt is not None:
        client = appt.client or db.session.get(Client, appt.client_id)
    if client is None:
        return False
    objetivo = normalizar(getattr(setter, 'username', None))

    # 1 y 2: cualquier agenda de esta persona que generó él o que tiene su fuente.
    for setter_id, origen in db.session.query(Appointment.setter_id, Appointment.origin).filter(
            Appointment.client_id == client.id):
        if setter_id == setter.id or (objetivo and normalizar(origen) == objetivo):
            return True
    if not objetivo:
        return False

    ventas = _ventas_de(client)

    # 4: un pago con su nombre como setter.
    if any(normalizar(v.setter) == objetivo for v in ventas):
        return True

    # 3: una fila del Tablero con su nombre y el contacto de la persona o de alguno de sus pagos.
    igs = {i for i in [_ig(client.instagram)] + [_ig(v.instagram) for v in ventas] if i}
    mails = {m for m in [_mail(client.email)] + [_mail(v.mail_cliente) for v in ventas] if m}
    condiciones = []
    if igs:
        condiciones.append(func.lower(func.replace(FinancialAgenda.instagram, '@', '')).in_(sorted(igs)))
    if mails:
        condiciones.append(func.lower(FinancialAgenda.mail).in_(sorted(mails)))
    if not condiciones:
        return False
    return any(normalizar(nombre) == objetivo
               for (nombre,) in db.session.query(FinancialAgenda.nombre).filter(or_(*condiciones)).distinct())


def puede_abrir(usuario, appointment_id=None, client_id=None):
    """False solo cuando `usuario` es un setter y el lead pedido no es suyo.

    Se resuelve ANTES de armar la ficha y sin crear nada: abrir un cliente sin agenda le ancla una
    (`resolver_lead`), y un setter que pide uno ajeno no puede dejar esa escritura de rastro. Un id
    que no existe pasa: el 404 lo da quien arma la ficha, igual para todos."""
    if getattr(usuario, 'role', None) != 'setter':
        return True
    if appointment_id:
        appt = db.session.get(Appointment, appointment_id)
        return appt is None or es_lead_del_setter(usuario, appt=appt)
    if client_id:
        client = db.session.get(Client, client_id)
        return client is None or es_lead_del_setter(usuario, client=client)
    return True
