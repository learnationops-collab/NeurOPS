"""El anuncio de cada palabra clave que ya llegó por ManyChat y nunca se registró

Hasta el 14/10/2026 un anuncio existía solo si alguien lo cargaba a mano; las palabras clave que llegaban sin uno
(«Obtener Guia», «Guia Peru», las demás guías…) quedaban sin anuncio y los setters no las encontraban al ponerle la
palabra clave a una agenda. Desde ese día el webhook crea el anuncio solo; esta migración hace lo mismo con las que ya
llegaron:

  · crea un anuncio (sin campaña ni conjunto) por cada palabra clave que no tiene uno, con la escritura más usada y
    la fecha de la primera vez que llegó;
  · les pone ese anuncio a las interacciones de esa palabra clave que no tenían ninguno, como hace hoy el webhook.

No toca las interacciones que ya tenían anuncio. Se puede correr de nuevo sin efecto.

Revision ID: e5b8d2f4a1c7
Revises: d3f7a1c9e5b2
Create Date: 2026-10-15 10:00:00.000000

"""
import re
import unicodedata
from collections import Counter, defaultdict

import sqlalchemy as sa
from alembic import op

revision = 'e5b8d2f4a1c7'
down_revision = 'd3f7a1c9e5b2'
branch_labels = None
depends_on = None

# Copias congeladas de `app.models.marketing.clave_de_palabra` y `anuncios_service.es_keyword_valida`.
CLAVES_QUE_NO_SON = {'MANUAL ATTRIBUTION', 'NULL', 'NONE', 'UNDEFINED', 'INDETERMINADO', 'N A'}


def _clave(texto):
    if not isinstance(texto, str):
        return None
    sin_tildes = ''.join(c for c in unicodedata.normalize('NFKD', texto) if not unicodedata.combining(c))
    limpio = re.sub(r'[^A-Z0-9]+', ' ', sin_tildes.upper()).strip()
    return limpio[:100] or None


def _valida(valor):
    if not isinstance(valor, str):
        return False
    texto = valor.strip()
    if not texto or len(texto) > 100 or '{{' in texto or '}}' in texto or 'cuf_' in texto.lower():
        return False
    clave = _clave(texto)
    return bool(clave) and clave not in CLAVES_QUE_NO_SON


def upgrade():
    conexion = op.get_bind()
    con_anuncio = {fila[0] for fila in conexion.execute(sa.text('SELECT clave FROM ads WHERE clave IS NOT NULL'))}

    escrituras, primera = defaultdict(Counter), {}
    for keyword, n, desde in conexion.execute(sa.text(
            'SELECT keyword, COUNT(*), MIN(created_at) FROM lead_answers WHERE keyword IS NOT NULL GROUP BY keyword')):
        if not _valida(keyword):
            continue
        clave = _clave(keyword)
        escrituras[clave][keyword] += n
        if desde is not None and (clave not in primera or str(desde) < str(primera[clave])):
            primera[clave] = desde

    for clave, conteo in escrituras.items():
        if clave not in con_anuncio:
            nombre = conteo.most_common(1)[0][0].strip()[:100]
            conexion.execute(sa.text(
                "INSERT INTO ads (name, keyword, clave, status, created_at) "
                "VALUES (:nombre, :nombre, :clave, 'active', :creado)"),
                {'nombre': nombre, 'clave': clave, 'creado': primera.get(clave)})
        # El anuncio vigente de la clave: el más nuevo sin archivar (como `anuncios_service._vigente`).
        anuncio_id = conexion.execute(sa.text(
            "SELECT id FROM ads WHERE clave = :clave "
            "ORDER BY CASE WHEN status = 'archived' THEN 0 ELSE 1 END DESC, id DESC LIMIT 1"),
            {'clave': clave}).scalar()
        for keyword in conteo:
            conexion.execute(sa.text(
                'UPDATE lead_answers SET ad_id = :anuncio WHERE ad_id IS NULL AND keyword = :keyword'),
                {'anuncio': anuncio_id, 'keyword': keyword})


def downgrade():
    # Los anuncios creados acá ya pueden tener agendas atribuidas por los setters: no se borran.
    pass
