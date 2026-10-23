"""Las palabras clave de Marketing: cuál es válida, su anuncio y la de cada interacción de ManyChat.

Ver el docstring de `anuncios_service` (que re-exporta todo esto).
"""
from collections import defaultdict

from app import db
from app.models import Ad, LeadAnswer
from app.models.marketing import clave_de_palabra as clave_de

# Lo que llega en `keyword` y no es una palabra clave: la marca de la atribución manual (la deja la
# bandeja del setter, ver `palabra_clave_service.KEYWORD_MANUAL`) y los vacíos de ManyChat.
CLAVES_QUE_NO_SON = frozenset({'MANUAL ATTRIBUTION', 'NULL', 'NONE', 'UNDEFINED', 'INDETERMINADO', 'N A'})
LARGO_MAXIMO = 100
# Para no armar consultas IN con miles de parámetros (SQLite corta en 999 en versiones viejas).
TANDA = 500


def es_keyword_valida(valor):
    """¿Es una palabra clave de verdad? Descarta variables sin reemplazar de ManyChat (`{{keyword}}`,
    `cuf_…`), los vacíos y la marca de la atribución manual."""
    if not isinstance(valor, str):
        return False
    texto = valor.strip()
    if not texto or len(texto) > LARGO_MAXIMO or '{{' in texto or '}}' in texto or 'cuf_' in texto.lower():
        return False
    clave = clave_de(texto)
    return bool(clave) and clave not in CLAVES_QUE_NO_SON


def _vigente(anuncios):
    """De varios anuncios con la misma clave, el que manda: el más nuevo sin archivar (o el más nuevo)."""
    if not anuncios:
        return None
    return max(anuncios, key=lambda a: ((a.status or '').lower() != 'archived', a.id))


def anuncio_de_clave(clave):
    if not clave:
        return None
    return _vigente(Ad.query.filter(Ad.clave == clave).all())


def anuncio_de_keyword(keyword, crear=True):
    """El anuncio de esa palabra clave; si no existe y `crear`, lo crea (sin campaña ni conjunto).

    No hace commit: lo hace quien lo llama (el webhook guarda el anuncio con la interacción). Un anuncio
    nuevo le avisa a la asociación con Meta, por si ya había un anuncio de Meta que la nombraba.
    """
    if not es_keyword_valida(keyword):
        return None
    clave = clave_de(keyword)
    anuncio = anuncio_de_clave(clave)
    if anuncio or not crear:
        return anuncio
    texto = keyword.strip()[:LARGO_MAXIMO]
    anuncio = Ad(name=texto, keyword=texto, clave=clave, status='active')
    db.session.add(anuncio)
    db.session.flush()
    from app.services import meta_ads_service
    meta_ads_service.mapear_automatico()
    return anuncio


def claves_conocidas():
    """Todas las palabras clave que el sistema conoce: las de los anuncios y las que llegaron en algún
    webhook (las anteriores a este cambio no tienen anuncio)."""
    claves = {a.clave for a in Ad.query.filter(Ad.clave.isnot(None)).all()}
    for (keyword,) in db.session.query(LeadAnswer.keyword).filter(LeadAnswer.keyword.isnot(None)).distinct():
        if es_keyword_valida(keyword):
            claves.add(clave_de(keyword))
    return claves - {None}


# --- Lectura: de cada interacción, su palabra clave ---------------------------------------------

def _clave_de_cada_anuncio():
    return {a.id: (a.clave or clave_de(a.keyword) or clave_de(a.name)) for a in Ad.query.all()}


def _en_tandas(valores):
    valores = list(valores)
    for i in range(0, len(valores), TANDA):
        yield valores[i:i + TANDA]


def _respondio(opcion):
    """`id_option` es el mensaje del flujo que la persona contestó; 0 (o vacío) es que no contestó."""
    return (opcion or '').strip() not in ('', '0', '0.0')


def _interacciones(lead_ids, clave_de_anuncio):
    """{lead_id: [(instante, clave, calificacion, respondio), ...]} ordenadas, con la palabra clave ya resuelta
    (ver el docstring del módulo: la interacción sin palabra clave toma la de la conversación)."""
    crudas = defaultdict(list)
    for tanda in _en_tandas(lead_ids):
        for lead_id, ad_id, keyword, calificacion, opcion, creada in db.session.query(
                LeadAnswer.conversation_id, LeadAnswer.ad_id, LeadAnswer.keyword, LeadAnswer.qualification,
                LeadAnswer.id_option, LeadAnswer.created_at).filter(LeadAnswer.conversation_id.in_(tanda)):
            if creada is None:
                continue
            clave = clave_de(keyword) if es_keyword_valida(keyword) else None
            # El anuncio manda sobre el texto: la bandeja del setter le pone el anuncio a una
            # interacción que ya existía, y ése es el anuncio que eligió.
            if ad_id and clave_de_anuncio.get(ad_id):
                clave = clave_de_anuncio[ad_id]
            crudas[lead_id].append((creada, clave, calificacion, _respondio(opcion)))

    resultado = {}
    for lead_id, filas in crudas.items():
        filas.sort(key=lambda f: f[0])
        primera = next((fila[1] for fila in filas if fila[1]), None)
        actual, resueltas = primera, []
        for creada, clave, calificacion, respondio in filas:
            if clave:
                actual = clave
            resueltas.append((creada, actual, calificacion, respondio))
        resultado[lead_id] = resueltas
    return resultado
