"""El país de una persona para los tableros (Dirección comercial y Marketing), 04/11/2026.

El país no se guarda en el cliente: se lee del código de su WhatsApp (`Person.phone`, y si no el
`Client.phone`), con la lista de países del formulario de agendas (`agendas_v2.nucleo.catalogos`).
Una sola regla para todas las pantallas, así una persona cae en el mismo país en Revisar, en Analizar
y en Marketing. Sin teléfono, o con uno sin código reconocible, queda en «Sin país»: es un grupo más,
no un descarte, y los países suman siempre el total.
"""
import re

from app import db
from app.agendas_v2.nucleo.catalogos import PAISES
from app.models import Client, Person

SIN = 'sin'
# Países que el formulario de agendas no ofrece pero de los que llegan WhatsApps (Renan Aguilera, +504 Honduras,
# quedaba «Sin país»). Mismos códigos que `PAIS_DE_CODIGO` de las postulaciones; se suman a los del formulario.
EXTRAS = [
    {'c': 'GT', 'n': 'Guatemala', 'd': '+502'}, {'c': 'SV', 'n': 'El Salvador', 'd': '+503'},
    {'c': 'HN', 'n': 'Honduras', 'd': '+504'}, {'c': 'NI', 'n': 'Nicaragua', 'd': '+505'},
    {'c': 'CU', 'n': 'Cuba', 'd': '+53'}, {'c': 'PT', 'n': 'Portugal', 'd': '+351'},
    {'c': 'IT', 'n': 'Italia', 'd': '+39'}, {'c': 'DO', 'n': 'República Dominicana', 'd': '+1809'},
]
_PAISES_TODOS = [{'c': p['c'], 'n': p['n'], 'd': p['d']} for p in PAISES] + EXTRAS
ETIQUETAS = {**{p['c']: p['n'] for p in _PAISES_TODOS}, SIN: 'Sin país'}
_POR_LARGO = sorted(_PAISES_TODOS, key=lambda p: -len(p['d']))
TANDA = 500


def de_numero(numero):
    """«+56 9 1234 5678» → 'CL'. Sin «+» se acepta solo si lo que sigue al código tiene el largo de un
    número nacional (un «1123456789» argentino sin código no es de Estados Unidos). None si no se sabe."""
    crudo = str(numero or '').strip()
    digitos = re.sub(r'\D', '', crudo)
    if not digitos:
        return None
    con_mas = crudo.startswith('+') or crudo.startswith('00')
    if crudo.startswith('00'):
        digitos = digitos[2:]
    for p in _POR_LARGO:
        codigo = p['d'].lstrip('+')
        if not digitos.startswith(codigo):
            continue
        resto = len(digitos) - len(codigo)
        if con_mas or (resto == 10 if codigo == '1' else 7 <= resto <= 11):
            return p['c']
    return None


def lista():
    """Todos los países y «Sin país», como los espera la pantalla."""
    return [{'key': k, 'label': v} for k, v in ETIQUETAS.items()]


def parsear(valor):
    """`?pais=CL,MX,sin` → {'CL', 'MX', 'sin'}; None si no se pidió ninguno (sin filtro)."""
    elegidos = {p.strip() for p in str(valor or '').split(',')}
    elegidos = {p.upper() if p.upper() in ETIQUETAS else p.lower() for p in elegidos} & set(ETIQUETAS)
    return elegidos or None


def _tandas(valores):
    valores = sorted(valores)
    for i in range(0, len(valores), TANDA):
        yield valores[i:i + TANDA]


def de_personas(uuids):
    """{person_uuid: país} de las personas cuyo teléfono se reconoce."""
    salida = {}
    for tanda in _tandas({u for u in uuids if u}):
        for puuid, tel in db.session.query(Person.uuid, Person.phone).filter(Person.uuid.in_(tanda)):
            pais = de_numero(tel)
            if pais:
                salida[puuid] = pais
    return salida


def de_clientes(ids):
    """{client_id: país} de los clientes cuyo teléfono se reconoce."""
    salida = {}
    for tanda in _tandas({i for i in ids if isinstance(i, int)}):
        for cid, tel in db.session.query(Client.id, Client.phone).filter(Client.id.in_(tanda)):
            pais = de_numero(tel)
            if pais:
                salida[cid] = pais
    return salida


def de_filas(filas, persona='person_uuid', cliente='client_id'):
    """País (código o 'sin') de filas del dashboard comercial (dicts con `person_uuid` y `client_id`)."""
    por_persona = de_personas(f.get(persona) for f in filas)
    por_cliente = de_clientes(f.get(cliente) for f in filas)
    return [por_persona.get(f.get(persona)) or por_cliente.get(f.get(cliente))
            or de_numero(f.get('telefono')) or SIN for f in filas]


def con_pais(filas):
    """Suma `pais` (código) y `pais_nombre` a cada fila y las devuelve."""
    for f, codigo in zip(filas, de_filas(filas)):
        f['pais'] = codigo
        f['pais_nombre'] = ETIQUETAS[codigo]
    return filas


def filtrar(filas, elegidos):
    """Las filas de los países elegidos (vacío o None = todas), con su `pais`."""
    con_pais(filas)
    return [f for f in filas if f['pais'] in elegidos] if elegidos else filas


# --- Marketing: los hechos de `segmentos_marketing_service` (agendas del libro, cobros y conversaciones) ---

def de_agendas_del_libro(agendas_ids):
    """{id de FinancialAgenda: país} (código o 'sin'): el de su persona."""
    from app.models import FinancialAgenda

    personas = {}
    for tanda in _tandas(set(agendas_ids)):
        personas.update(db.session.query(FinancialAgenda.id, FinancialAgenda.person_uuid)
                        .filter(FinancialAgenda.id.in_(tanda)))
    por_persona = de_personas(personas.values())
    return {aid: por_persona.get(puuid, SIN) for aid, puuid in personas.items()}


def de_cobros(cobros):
    """{id del cobro: país}: el de su persona, el de su cliente (`clientes_de_ventas`) o el teléfono del cobro."""
    from app.services.comercial_service import clientes_de_ventas

    cobros = list(cobros)
    cliente_de = clientes_de_ventas(cobros)
    por_persona = de_personas(c.person_uuid for c in cobros)
    por_cliente = de_clientes(cliente_de.values())
    return {c.id: (por_persona.get(c.person_uuid) or por_cliente.get(cliente_de.get(c.id))
                   or de_numero(getattr(c, 'telefono', None)) or SIN) for c in cobros}


def de_conversaciones(ids):
    """{id de la conversación: país}: el de su persona."""
    from app.models import Conversation

    personas = {}
    for tanda in _tandas({i for i in ids if isinstance(i, int)}):
        personas.update(db.session.query(Conversation.id, Conversation.person_uuid).filter(Conversation.id.in_(tanda)))
    por_persona = de_personas(personas.values())
    return {cid: por_persona.get(personas.get(cid), SIN) for cid in ids if isinstance(cid, int)}
