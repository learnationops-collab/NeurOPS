"""La baja de un cliente: se fue del programa, lo que pagó queda y la deuda no.

Pedido del usuario (30/09/2026): «las personas que se dan de baja [tienen que] dejar de aparecer en
las listas. Lo que ya pagó sí queda como dinero recaudado, pero la deuda debe desaparecer y debe
marcarse que se dio de baja [...] y que se vea en otro filtro».

Antes «Dar de baja» solo cerraba el seguimiento de la agenda (`seguimiento_sub = 'Baja: …'`) y
dejaba un comentario: el cliente seguía debiendo y seguía en la cola de cobro, en «Con deuda», en
las cuotas vencidas y en los totales.

Por qué la baja vive en el CLIENTE (`Client.baja_at/baja_motivo/baja_por_id`) y no en otro lado:

  · la deuda es por persona: `Client.total_amount` es UN total por cliente y `_client_debt` suma
    todas sus inscripciones. Una baja por inscripción dejaría viva la deuda de las otras;
  · lo cobrado vive en `FinancialSale` y `Payment`, y no se toca: el cash y lo recaudado siguen
    contándolo tal cual, sin que ninguna consulta de cash tenga que enterarse de la baja;
  · las cuotas (`InstallmentPlan`) tampoco se tocan. Cancelarlas obligaría a recordar cuáles
    cancelo la baja para poder revertirla, y el editor del plan normaliza cualquier estado que no
    sea 'pagado' a 'pendiente': una cuota 'cancelada' volvería sola en la primera edición. Con la
    marca en el cliente, quien lee cuotas pendientes pregunta por la baja y listo;
  · revertir es borrar la marca. Como nada se destruyó, la deuda y el cronograma vuelven exactos.

Quien calcula deuda o arma una lista de cobro pregunta acá (`esta_de_baja`, `ids_de_baja`,
`sin_baja`). La deuda en sí sigue viviendo en `CloserFollowUpService._client_debt`, que devuelve 0
para un cliente de baja: este módulo no calcula plata.
"""
from datetime import datetime

from app import db
from app.models import Client

# Lo que la acción de la ficha escribe en `seguimiento_sub`. El seguimiento que se agenda al dar de
# baja (el «¿agendás un seguimiento a futuro?», un recontacto) es el único de un cliente de baja
# que sigue apareciendo en los seguimientos del día: lo pidió quien dio la baja.
PREFIJO_SEGUIMIENTO = 'Baja:'

MESES = ('ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic')


def esta_de_baja(client):
    return bool(client is not None and getattr(client, 'baja_at', None))


def motivo_legible(motivo):
    """La etiqueta de un motivo de fábrica (`no_puede_pagar` -> «No puede pagar»), o el texto tal cual.

    El desplegable de la baja manda la CLAVE de un motivo de fábrica y el texto de uno agregado en
    «Otros»: sin traducir, la clave cruda llegaba a la cabecera de la ficha y al hilo del cliente.
    Solo las de fábrica, a propósito: las de «Otros» ya viajan como texto, y así una lista con
    muchas bajas no consulta el vocabulario por fila. También cubre las bajas recuperadas por la
    migración, que traen la clave del `seguimiento_sub` viejo.
    """
    from app.services.ficha_vocabulario import MOTIVOS_BAJA

    etiquetas = {o['clave']: o['label'] for g in MOTIVOS_BAJA for o in g['opciones']}
    return etiquetas.get(motivo, motivo)


def descriptor(client):
    """`{fecha, fecha_legible, motivo, por}` de la baja, o None si el cliente no está de baja.

    Es lo que viaja a la ficha, a la tabla Clientes y a la etapa de cobro: los tres dicen lo mismo
    con las mismas palabras.
    """
    if not esta_de_baja(client):
        return None
    from app.models import User

    fecha = client.baja_at
    # Por id y no por una relación: la marca se escribe con el id (quien la da puede ser el
    # `current_user` de Flask-Login, que es un proxy) y una relación ya cargada no se enteraría
    # hasta el próximo commit. `session.get` sale del mapa de identidad: en una lista con muchas
    # bajas del mismo closer es una sola consulta.
    autor = db.session.get(User, client.baja_por_id) if client.baja_por_id else None
    return {
        'fecha': fecha.isoformat(),
        # A mano y no con `strftime('%b')`, que depende del locale del servidor.
        'fecha_legible': f'{fecha.day} {MESES[fecha.month - 1]} {fecha.year}',
        'motivo': motivo_legible(client.baja_motivo) or None,
        'por': autor.username if autor else None,
    }


def ids_de_baja(ids=None):
    """Los ids de los clientes de baja: de todos, o de entre `ids`. Una consulta.

    Para quien arma una lista de muchos clientes y no quiere preguntar de a uno.
    """
    q = db.session.query(Client.id).filter(Client.baja_at.isnot(None))
    if ids is not None:
        ids = list(ids)
        if not ids:
            return set()
        from app.services.closer_followup_service import _en_tandas
        encontrados = set()
        for tanda in _en_tandas(ids):
            encontrados.update(cid for (cid,) in q.filter(Client.id.in_(tanda)))
        return encontrados
    return {cid for (cid,) in q}


def sin_baja():
    """Condición SQL «la agenda NO es de un cliente de baja», para filtrar `Appointment`.

    `NOT EXISTS` y no `client_id NOT IN (...)`: con un `client_id` nulo el `NOT IN` da NULL y la
    agenda desaparecería de la lista sin ser de nadie de baja.
    """
    from app.models import Appointment
    return ~Appointment.client.has(Client.baja_at.isnot(None))


def seguimiento_en_pie():
    """Condición SQL «el seguimiento de esta agenda sigue en las listas», para filtrar `Appointment`.

    De un cliente dado de baja se cae todo lo que estaba pendiente de ANTES de la baja: el cobro
    que había agendado, el pool, lo vencido. Queda lo que alguien pidió al darlo de baja o
    después, a sabiendas de que ya no es un cobro:

      · el recontacto que se agenda al dar la baja («¿Agendás un seguimiento a futuro?»), que vive
        en la agenda con `seguimiento_sub = 'Baja: …'`;
      · un seguimiento que se escribió en una agenda después de la baja (`updated_at` posterior),
        p. ej. uno agendado desde el historial de la ficha. Esconderlo sería dejar a quien lo pidió
        esperando un aviso que nunca llega.

    Los clientes que no están de baja no se ven afectados.
    """
    from sqlalchemy import and_, or_
    from app.models import Appointment

    pendiente_de_antes = Appointment.client.has(and_(
        Client.baja_at.isnot(None),
        or_(Appointment.updated_at.is_(None), Appointment.updated_at < Client.baja_at)))
    return or_(~pendiente_de_antes,
               Appointment.seguimiento_sub.like(f'{PREFIJO_SEGUIMIENTO}%'))


def dar_de_baja(client, motivo, usuario, cuando=None):
    """Marca la baja. Devuelve True si el cliente no estaba de baja.

    Darla dos veces no mueve la fecha: la baja ocurrió la primera vez. Sí actualiza el motivo, que
    es lo que alguien pudo querer corregir al repetirla. No comitea: la acción de la ficha escribe
    en el mismo commit el seguimiento, el comentario y la marca, y no puede quedar una sin la otra.
    """
    if client is None:
        return False
    nueva = not esta_de_baja(client)
    if nueva:
        client.baja_at = cuando or datetime.utcnow()
        client.baja_por_id = getattr(usuario, 'id', None)
        # La baja también le corta el acceso a la Academia (pedido del 30/09/2026), pero eso es
        # una llamada a otro sistema y va DESPUÉS del commit, cuando la baja ya quedó guardada:
        # queda anotado acá y lo hace quien terminó la acción (`ficha_academia.quitar_accesos_de_bajas`).
        db.session.info.setdefault(_PENDIENTES_ACADEMIA, []).append(client.id)
    client.baja_motivo = ((motivo or '').strip()[:255]) or client.baja_motivo
    return nueva


# Clave de `db.session.info` con los clientes que se dieron de baja en este pedido y a los que
# todavía no se les quitó el acceso a la Academia. La sesión vive lo que dura el pedido.
_PENDIENTES_ACADEMIA = 'bajas_sin_quitar_academia'


def bajas_sin_quitar_academia():
    """Los ids de los clientes dados de baja en este pedido, y los saca de la lista."""
    return db.session.info.pop(_PENDIENTES_ACADEMIA, [])


def revertir(client):
    """Borra la marca y devuelve el descriptor que tenía (None si no estaba de baja).

    No toca nada más: la deuda y las cuotas vuelven solas porque nunca se tocaron. No comitea, por
    lo mismo que `dar_de_baja`.
    """
    anterior = descriptor(client)
    if anterior is None:
        return None
    client.baja_at = None
    client.baja_motivo = None
    client.baja_por_id = None
    return anterior
