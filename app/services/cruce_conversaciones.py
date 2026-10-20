"""Encontrarle a una persona del sistema (cliente, agenda, venta) su conversación de ManyChat.

Lo usan Marketing (`anuncios_service._Atribuidor`, la palabra clave de cada agenda y cada venta) y la
bandeja «Mis agendas» del setter (`palabra_clave_service`), con la misma regla para que no se
contradigan. En orden, cada paso solo si el anterior no encontró nada:

  0. La misma persona (`person_uuid`, 20/10/2026, docs/plan_personas.md): la conversación ya está
     vinculada a ella y no hace falta adivinar por Instagram ni por nombre.
  1. El Instagram exacto (sin «@», en minúsculas).
  2. El Instagram «compacto», solo letras y números (17/10/2026): «luis.rinnegan» es «luis_rinnegan»,
     y el setter que escribe el nombre en el campo del Instagram («greta castro gallo») encuentra
     «gretacastrogallo». Con 6 caracteres o más: uno corto se parece a demasiados.
  3. El nombre completo exacto (sin tildes, ≥ 2 palabras), cuando UNA sola conversación lo tiene.
  4. El nombre contenido (17/10/2026): todas las palabras del nombre están en el de UNA sola
     conversación y la primera coincide («Greta Castro» → «Greta Castro Gallo»). Con dos candidatas
     no se elige ninguna.

Medido en staging (14/09–13/10/2026), con los pasos 2 y 4: el cobrado de Marketing pasó de $5.088 a
$5.488 y las agendas atribuidas de 117 a 125. El resto ($10.336) son ventas del workshop, la VSL,
renovaciones y setting sin conversación de ManyChat, que no pasan por una palabra clave.
"""
import re
import unicodedata
from collections import defaultdict

from sqlalchemy import func

from app import db
from app.models import ManychatLead
from app.services.identity_service import normalize_ig

TANDA = 500
LARGO_MINIMO_COMPACTO = 6


def _en_tandas(valores):
    valores = list(valores)
    for i in range(0, len(valores), TANDA):
        yield valores[i:i + TANDA]


def _sin_tildes(texto):
    return ''.join(c for c in unicodedata.normalize('NFKD', texto) if not unicodedata.combining(c)).lower()


def compacto(ig):
    """El Instagram con solo letras y números; None si queda corto para identificar a alguien."""
    if not isinstance(ig, str):
        return None
    limpio = re.sub(r'[^a-z0-9]+', '', _sin_tildes(ig))
    return limpio if len(limpio) >= LARGO_MINIMO_COMPACTO else None


def clave_de_nombre(texto):
    """El nombre para compararlo con el de ManyChat: sin tildes, en minúsculas, solo letras.
    None con menos de dos palabras: un nombre solo («Mariana») no identifica a nadie."""
    if not isinstance(texto, str):
        return None
    palabras = re.sub(r'[^a-z]+', ' ', _sin_tildes(texto)).split()
    return ' '.join(palabras) if len(palabras) >= 2 else None


def leads_por_persona(person_uuids):
    """{person_uuid: [lead_id, ...]} de las conversaciones ya vinculadas a cada persona."""
    por_persona = defaultdict(list)
    for tanda in _en_tandas({u for u in person_uuids if u}):
        for lead_id, puuid in db.session.query(ManychatLead.id, ManychatLead.person_uuid).filter(
                ManychatLead.person_uuid.in_(tanda)):
            por_persona[puuid].append(lead_id)
    return por_persona


def leads_por_ig(igs):
    """{ig normalizado: [lead_id, ...]} de las conversaciones con ese Instagram exacto."""
    ig_columna = func.lower(func.replace(ManychatLead.ig, '@', ''))
    por_ig = defaultdict(list)
    for tanda in _en_tandas({ig for ig in igs if ig}):
        for lead_id, ig in db.session.query(ManychatLead.id, ig_columna).filter(ig_columna.in_(tanda)):
            ig_n = normalize_ig(ig)
            if ig_n:
                por_ig[ig_n].append(lead_id)
    return por_ig


def leads_por_ig_parecido(igs):
    """{ig: [lead_id, ...]} por el Instagram compacto (paso 2), para los que no se encontraron exactos.
    Recorre las conversaciones una vez: la comparación no se puede pedir en SQL portable."""
    buscados = defaultdict(set)
    for ig in igs:
        c = compacto(ig)
        if c:
            buscados[c].add(ig)
    if not buscados:
        return {}
    por_ig = defaultdict(list)
    for lead_id, ig in db.session.query(ManychatLead.id, ManychatLead.ig).filter(ManychatLead.ig.isnot(None)):
        for original in buscados.get(compacto(ig), ()):
            por_ig[original].append(lead_id)
    return por_ig


def leads_por_nombre(nombres):
    """{nombre normalizado: lead_id} por el nombre completo exacto (paso 3) o, si no, contenido en el
    de una sola conversación (paso 4). Con dos personas candidatas no se elige ninguna."""
    nombres = {n for n in nombres if n}
    if not nombres:
        return {}
    exactos = defaultdict(set)
    por_primera = defaultdict(list)
    for lead_id, nombre in db.session.query(ManychatLead.id, ManychatLead.name).filter(ManychatLead.name.isnot(None)):
        clave = clave_de_nombre(nombre)
        if not clave:
            continue
        if clave in nombres:
            exactos[clave].add(lead_id)
        palabras = clave.split()
        por_primera[palabras[0]].append((lead_id, set(palabras)))

    resultado = {clave: ids.pop() for clave, ids in exactos.items() if len(ids) == 1}
    for clave in nombres - set(exactos):
        palabras = clave.split()
        candidatos = {lead_id for lead_id, suyas in por_primera.get(palabras[0], ()) if set(palabras) <= suyas}
        if len(candidatos) == 1:
            resultado[clave] = candidatos.pop()
    return resultado


class Cruce:
    """Las conversaciones de un grupo de personas, leídas una vez: `candidatos(ig, nombre, persona)` da
    los lead_ids de cada paso, en orden, para que quien llama se quede con el primero que le sirva."""

    def __init__(self, igs, nombres=(), personas=()):
        self.por_persona = leads_por_persona(personas)
        igs = {normalize_ig(ig) for ig in igs} - {None}
        self.por_ig = leads_por_ig(igs)
        self.por_ig_parecido = leads_por_ig_parecido(igs - set(self.por_ig))
        self.por_nombre = leads_por_nombre({clave_de_nombre(n) for n in nombres})

    def lead_ids(self):
        return ({lid for ids in self.por_persona.values() for lid in ids}
                | {lid for ids in self.por_ig.values() for lid in ids}
                | {lid for ids in self.por_ig_parecido.values() for lid in ids}
                | set(self.por_nombre.values()))

    def candidatos(self, ig, nombre=None, persona=None):
        yield self.por_persona.get(persona, ())
        ig = normalize_ig(ig)
        yield self.por_ig.get(ig, ())
        yield self.por_ig_parecido.get(ig, ())
        lead = self.por_nombre.get(clave_de_nombre(nombre))
        yield (lead,) if lead else ()
