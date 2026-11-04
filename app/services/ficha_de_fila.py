"""A qué ficha del lead abre una fila de las listas de cifras de Marketing (Setting, Workshop, Otras), 03/11/2026.

Cada fila de una persona lleva `ficha`, con la clave que entiende `GET /api/ficha/lead`: `appointment_id`,
`client_id` o `person_uuid`. Una fila sin `ficha` no se abre (una campaña, un anuncio, una persona que todavía
no es cliente: la ficha del lead cuelga del cliente y con `person_uuid` solo devolvería 404).
"""
from app.models import Client

_LOTE = 500


def personas_con_cliente(uuids):
    """{person_uuid: id de su cliente} de las de `uuids` que tienen uno: las únicas que la ficha puede abrir por persona.
    Con el cliente, la fila también puede eliminar el lead de prueba aunque no tenga ninguna agenda (04/11/2026)."""
    pedidas = sorted({u for u in uuids if u})
    con = {}
    for i in range(0, len(pedidas), _LOTE):
        for uuid, cid in Client.query.with_entities(Client.person_uuid, Client.id)                 .filter(Client.person_uuid.in_(pedidas[i:i + _LOTE])).order_by(Client.id):
            con.setdefault(uuid, cid)
    return con


def ficha_de(appointment_id=None, client_id=None, person_uuid=None, con_cliente=()):
    """`{'appointment_id': 12}`, `{'client_id': 5}` o `{'person_uuid': '…', 'client_id': 5}`, o None si no hay cómo abrirla."""
    if appointment_id:
        return {'appointment_id': int(appointment_id)}
    if client_id:
        return {'client_id': int(client_id)}
    if person_uuid and person_uuid in con_cliente:
        cliente = con_cliente.get(person_uuid) if isinstance(con_cliente, dict) else None
        return {'person_uuid': person_uuid, **({'client_id': int(cliente)} if cliente else {})}
    return None
