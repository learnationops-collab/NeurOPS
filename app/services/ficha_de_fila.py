"""A qué ficha del lead abre una fila de las listas de cifras de Marketing (Setting, Workshop, Otras), 03/11/2026.

Cada fila de una persona lleva `ficha`, con la clave que entiende `GET /api/ficha/lead`: `appointment_id`,
`client_id` o `person_uuid`. Una fila sin `ficha` no se abre (una campaña, un anuncio, una persona que todavía
no es cliente: la ficha del lead cuelga del cliente y con `person_uuid` solo devolvería 404).
"""
from app.models import Client

_LOTE = 500


def personas_con_cliente(uuids):
    """Las `person_uuid` de `uuids` que tienen un cliente: las únicas que la ficha puede abrir por persona."""
    pedidas = sorted({u for u in uuids if u})
    con = set()
    for i in range(0, len(pedidas), _LOTE):
        con.update(u for (u,) in Client.query.with_entities(Client.person_uuid)
                   .filter(Client.person_uuid.in_(pedidas[i:i + _LOTE])))
    return con


def ficha_de(appointment_id=None, client_id=None, person_uuid=None, con_cliente=()):
    """`{'appointment_id': 12}`, `{'client_id': 5}` o `{'person_uuid': '…'}`, o None si no hay cómo abrirla."""
    if appointment_id:
        return {'appointment_id': int(appointment_id)}
    if client_id:
        return {'client_id': int(client_id)}
    if person_uuid and person_uuid in con_cliente:
        return {'person_uuid': person_uuid}
    return None
