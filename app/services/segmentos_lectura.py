"""Lectura del segmento A/B/C/D para los tableros (Marketing, setters y closers).

El segmento lo calcula y guarda Thalamus (`segmento_service`, columnas `segmento*` de `clients` y
`appointments`); acá solo se LEE, con una sola regla para todas las pantallas así una persona cae en el
mismo segmento en Marketing, en el dashboard del setter y en el del closer:

  1. el de su agenda más reciente que lo tenga (el formulario con el que agendó);
  2. si no, el de su cliente (el último formulario que completó);
  3. si no, «sin segmento»: las ~120 agendas de octubre del flujo viejo (Calendly + n8n) que nunca
     pasaron por Thalamus, o personas que no llenaron el formulario.

«Sin segmento» es un grupo más, no un descarte: los segmentos A, B, C, D y «sin segmento» suman siempre el total.
"""
from app import db
from app.agendas_v2.nucleo.segmento import SEGMENTOS
from app.models import Appointment, Client

SIN = 'sin'
ORDEN = tuple(SEGMENTOS) + (SIN,)
ETIQUETAS = {**{s: s for s in SEGMENTOS}, SIN: 'Sin segmento'}
TANDA = 500


def clave(segmento):
    """La clave del grupo: A, B, C o D; cualquier otra cosa (None, vacío) es «sin»."""
    return segmento if segmento in SEGMENTOS else SIN


def lista():
    """Los grupos en orden, como los espera la pantalla."""
    return [{'key': k, 'label': ETIQUETAS[k]} for k in ORDEN]


def parsear(valor):
    """`?segmento=A,B,sin` → {'A', 'B', 'sin'}; None si no se pidió ninguno o se pidieron todos (sin filtro)."""
    elegidos = {p.strip() for p in str(valor or '').replace(' ', '').split(',')}
    elegidos = {p.upper() if p.upper() in SEGMENTOS else p.lower() for p in elegidos} & set(ORDEN)
    return None if not elegidos or elegidos == set(ORDEN) else elegidos


def _tandas(valores):
    valores = sorted(valores)
    for i in range(0, len(valores), TANDA):
        yield valores[i:i + TANDA]


def de_personas(uuids):
    """{person_uuid: 'A'|'B'|'C'|'D'} de las personas que tienen uno (las otras no están): la agenda más
    reciente con segmento y, si no, su cliente."""
    uuids = {u for u in uuids if u}
    salida = {}
    for tanda in _tandas(uuids):
        for puuid, seg in db.session.query(Appointment.person_uuid, Appointment.segmento).filter(
                Appointment.person_uuid.in_(tanda), Appointment.segmento.isnot(None)) \
                .order_by(Appointment.created_at, Appointment.id):
            salida[puuid] = seg
        for puuid, seg in db.session.query(Client.person_uuid, Client.segmento).filter(
                Client.person_uuid.in_(tanda), Client.segmento.isnot(None)).order_by(Client.id.desc()):
            salida.setdefault(puuid, seg)
    return salida


def de_clientes(ids):
    """{client_id: segmento} de los clientes que tienen uno."""
    salida = {}
    for tanda in _tandas({i for i in ids if isinstance(i, int)}):
        salida.update(db.session.query(Client.id, Client.segmento).filter(
            Client.id.in_(tanda), Client.segmento.isnot(None)))
    return salida


def de_agendas_del_libro(agendas_ids):
    """{id de FinancialAgenda: clave del grupo}: el de su persona (las de Calendly/n8n sin formulario de
    Thalamus quedan «sin»)."""
    from app.models import FinancialAgenda

    personas = {}
    for tanda in _tandas(set(agendas_ids)):
        personas.update(db.session.query(FinancialAgenda.id, FinancialAgenda.person_uuid)
                        .filter(FinancialAgenda.id.in_(tanda)))
    por_persona = de_personas(personas.values())
    return {aid: clave(por_persona.get(puuid)) for aid, puuid in personas.items()}


def de_cobros(cobros):
    """{id del cobro: clave del grupo} de una lista de `FinancialSale`: el de su persona y, si no tiene, el
    de su cliente (`clientes_de_ventas`)."""
    from app.services.comercial_service import clientes_de_ventas

    cobros = list(cobros)
    cliente_de = clientes_de_ventas(cobros)
    por_persona = de_personas(c.person_uuid for c in cobros)
    por_cliente = de_clientes(cliente_de.values())
    return {c.id: clave(por_persona.get(c.person_uuid) or por_cliente.get(cliente_de.get(c.id))) for c in cobros}


def de_conversaciones(ids):
    """{id de la conversación de ManyChat: clave del grupo}: el de su persona."""
    from app.models import Conversation

    personas = {}
    for tanda in _tandas({i for i in ids if isinstance(i, int)}):
        personas.update(db.session.query(Conversation.id, Conversation.person_uuid).filter(Conversation.id.in_(tanda)))
    por_persona = de_personas(personas.values())
    return {cid: clave(por_persona.get(personas.get(cid))) for cid in ids if isinstance(cid, int)}


def de_filas(filas, persona='person_uuid', cliente='client_id'):
    """Segmento de filas del dashboard comercial (agendas o ventas, dicts con `person_uuid` y `client_id`)
    a la clave de su grupo. Lee la agenda y el cliente en bloque."""
    por_persona = de_personas(f.get(persona) for f in filas)
    por_cliente = de_clientes(f.get(cliente) for f in filas)
    return [clave(por_persona.get(f.get(persona)) or por_cliente.get(f.get(cliente))) for f in filas]
