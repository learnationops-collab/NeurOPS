"""Etiquetas de UTM escritas a mano en los anuncios de Workshop (09/11/2026).

Las landings atribuyen cada visita al anuncio por el número que Meta pone en `utm_content={{ad.id}}` y
`utm_campaign={{campaign.id}}`. Del 27/10 al 09/11 los anuncios TC1 a TC5 llevaban en la dirección
etiquetas escritas a mano (`utm_content=tc1_pp_a4`, `utm_campaign=tc_pe_co`): ningún número coincidía
y esas visitas quedaban «sin anuncio».

Acá se traduce la etiqueta a su anuncio por el código del principio: `tc1_pp_a4` → el anuncio de
Workshop cuyo nombre empieza con «TC1». Solo si hay un único anuncio con ese código; si hay dos (un
duplicado con el mismo nombre) o ninguno, la etiqueta queda como vino. La campaña se toma del anuncio,
porque la etiqueta de campaña tampoco es un número.
"""
import re

from app.models import MetaAnuncio

_CODIGO_ETIQUETA = re.compile(r'^([a-z]+\d+)(?:_|$)')
_CODIGO_NOMBRE = re.compile(r'^\s*([A-Za-z]+\d+)\b')


def _limpio(valor):
    return (valor or '').strip() or None


def codigos_de_workshop():
    """{código en minúscula: (id del anuncio, id de la campaña)} de los anuncios de Workshop con un
    código único al principio del nombre («TC1 | Pizarrón PP A4» → 'tc1')."""
    vistos = {}
    for ad_id, nombre, campana_id in MetaAnuncio.query.with_entities(
            MetaAnuncio.meta_ad_id, MetaAnuncio.nombre, MetaAnuncio.campana_id).filter(
            MetaAnuncio.embudo == 'workshop'):
        m = _CODIGO_NOMBRE.match(nombre or '')
        if m:
            vistos.setdefault(m.group(1).lower(), []).append((ad_id, campana_id))
    return {codigo: filas[0] for codigo, filas in vistos.items() if len(filas) == 1}


def resolver(utm_campaign, utm_content, codigos):
    """(campaña, anuncio) de una visita: los números de Meta tal cual; una etiqueta escrita a mano,
    traducida a su anuncio si `codigos` la reconoce."""
    campana, contenido = _limpio(utm_campaign), _limpio(utm_content)
    if not contenido or contenido.isdigit():
        return campana, contenido
    m = _CODIGO_ETIQUETA.match(contenido.lower())
    anuncio = codigos.get(m.group(1)) if m else None
    if not anuncio:
        return campana, contenido
    ad_id, campana_id = anuncio
    return (campana if campana and campana.isdigit() else campana_id or campana), ad_id
