"""De qué conjunto de Meta vino cada persona, cuando se sabe (Kerwin, 04/11/2026).

Una palabra clave puede correr en varios conjuntos de Meta (GUIA GRATIS: cuatro). El tablero de Marketing reparte
el GASTO entre ellos, pero los leads, agendas y ventas iban enteros al conjunto principal (el de más gasto): el
conjunto «Winners | Guía Gratis | MX+PE» mostraba $348 y ceros. Mario lo reportó.

El motor de automatizaciones guarda en cada entrada el anuncio de Meta del que vino el DM (`AutEjecucion.meta_ad_id`).
Con eso, la persona se atribuye al conjunto de ESE anuncio. Los que no traen anuncio (comentarios, orgánico, los de
ManyChat) quedan en el conjunto principal de la palabra clave, como antes: no se inventa un reparto.

Solo cuenta si la palabra clave de la entrada es la del anuncio de Meta (`MetaAnuncio.clave`): así lo atribuido
sigue siendo parte del mismo grupo de gasto de esa palabra clave.
"""
from app import db
from app.automatizaciones.modelos import AutEjecucion, IgContacto
from app.models import Conversation, MetaAnuncio
from app.models.marketing import clave_de_palabra as clave_de

PREFIJO_IG = 'ig:'
TANDA = 500


def _en_tandas(valores):
    valores = sorted(valores)
    for i in range(0, len(valores), TANDA):
        yield valores[i:i + TANDA]


def por_persona():
    """{(persona, clave): (campaña, conjunto)}. `persona` es el `person_uuid` o, sin persona, `conversacion:<id>`
    (la misma clave con la que `anuncios_claves_service._por_persona` junta a quien tiene dos conversaciones).
    Gana la entrada más reciente de esa persona y palabra clave."""
    ejecuciones = db.session.query(AutEjecucion.clave, AutEjecucion.meta_ad_id, IgContacto.igsid) \
        .join(IgContacto, IgContacto.id == AutEjecucion.contacto_id) \
        .filter(AutEjecucion.meta_ad_id.isnot(None), AutEjecucion.clave.isnot(None)) \
        .order_by(AutEjecucion.iniciada_en, AutEjecucion.id).all()
    if not ejecuciones:
        return {}
    anuncios = {}
    for tanda in _en_tandas({e.meta_ad_id for e in ejecuciones}):
        for m in MetaAnuncio.query.filter(MetaAnuncio.meta_ad_id.in_(tanda)):
            anuncios[m.meta_ad_id] = m
    conversaciones = {}
    for tanda in _en_tandas({PREFIJO_IG + e.igsid for e in ejecuciones}):
        for cid, externo, persona in db.session.query(Conversation.id, Conversation.external_id, Conversation.person_uuid) \
                .filter(Conversation.external_id.in_(tanda)):
            conversaciones[externo] = persona or f'conversacion:{cid}'
    salida = {}
    for e in ejecuciones:
        anuncio = anuncios.get(e.meta_ad_id)
        persona = conversaciones.get(PREFIJO_IG + e.igsid)
        clave = clave_de(e.clave)
        if anuncio is None or persona is None or not clave or anuncio.clave != clave:
            continue
        salida[(persona, clave)] = (anuncio.campana or None, anuncio.conjunto or None)
    return salida
