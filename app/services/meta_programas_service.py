"""El programa de cada campaña de Meta y su gasto (Leadership 1395, ADR-W177).

Meta no sabe qué programa vende una campaña. Una persona la etiqueta en Marketing › Meta Ads (una vez por
campaña, vale para todos sus anuncios): AL, RR, SI o «general» (varios programas: su gasto no va a ninguno).
No hay detección automática a propósito: SPI-TRIPODE-* parece Specialist, pero lo decide una persona.
Las campañas de contratación no cuentan como «sin etiquetar» (no venden programas).
"""
from collections import defaultdict

from app import db
from app.models import MetaAnuncio, MetaCampanaPrograma, MetaGastoDiario

PROGRAMAS = ('AL', 'RR', 'SI')
GENERAL = 'general'
VALIDOS = PROGRAMAS + (GENERAL,)
ETIQUETAS = {'AL': 'Ace Learners', 'RR': 'Residency Roadmap', 'SI': 'Specialist Initiative',
             GENERAL: 'Varios programas'}


def mapa():
    """{campana_id: programa} de las campañas etiquetadas."""
    return dict(db.session.query(MetaCampanaPrograma.campana_id, MetaCampanaPrograma.programa).all())


def asignar(campana_id, programa, usuario=None):
    """Fija el programa de una campaña (o lo quita con `programa=None`). Hace commit. Devuelve el programa."""
    campana_id = str(campana_id or '').strip()
    if not campana_id:
        raise ValueError('Falta la campaña.')
    if programa is not None and programa not in VALIDOS:
        raise ValueError('El programa tiene que ser AL, RR, SI o general.')
    if not db.session.query(MetaAnuncio.id).filter(MetaAnuncio.campana_id == campana_id).first():
        raise LookupError('Esa campaña de Meta no está sincronizada.')
    fila = MetaCampanaPrograma.query.filter_by(campana_id=campana_id).first()
    if programa is None:
        if fila:
            db.session.delete(fila)
    elif fila:
        fila.programa, fila.actualizado_por = programa, usuario
    else:
        db.session.add(MetaCampanaPrograma(campana_id=campana_id, programa=programa, actualizado_por=usuario))
    db.session.commit()
    return programa


def _gasto_por_anuncio(desde, hasta):
    """[(meta_ad_id, nombre, campana, campana_id, embudo, gasto)] de los anuncios que gastaron en [desde, hasta]."""
    return db.session.query(
        MetaAnuncio.meta_ad_id, MetaAnuncio.nombre, MetaAnuncio.campana, MetaAnuncio.campana_id, MetaAnuncio.embudo,
        db.func.sum(MetaGastoDiario.gasto),
    ).join(MetaGastoDiario, MetaGastoDiario.meta_ad_id == MetaAnuncio.meta_ad_id) \
        .filter(MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta, MetaGastoDiario.gasto > 0) \
        .group_by(MetaAnuncio.meta_ad_id, MetaAnuncio.nombre, MetaAnuncio.campana, MetaAnuncio.campana_id,
                  MetaAnuncio.embudo).all()


def gasto(desde, hasta):
    """{por_programa: {AL: {gasto, campanas}}, general, sin_etiquetar: {gasto, campanas}} del período.
    Sin etiquetar = campañas con gasto y sin programa, sin las de contratación."""
    etiquetas = mapa()
    por = defaultdict(lambda: {'gasto': 0.0, 'campanas': set()})
    for _ad, _nombre, campana, campana_id, embudo, monto in _gasto_por_anuncio(desde, hasta):
        programa = etiquetas.get(campana_id)
        if programa is None and embudo == 'contratacion':
            continue
        clave = programa or None
        por[clave]['gasto'] += float(monto or 0)
        por[clave]['campanas'].add(campana_id or campana)

    def fila(k):
        f = por.get(k) or {'gasto': 0.0, 'campanas': set()}
        return {'gasto': round(f['gasto'], 2), 'campanas': len(f['campanas'])}

    return {'por_programa': {p: fila(p) for p in PROGRAMAS}, 'general': fila(GENERAL), 'sin_etiquetar': fila(None),
            'etiquetadas': len(etiquetas)}


_COLUMNAS = [
    {'key': 'anuncio', 'header': 'Anuncio', 'tipo': 'texto', 'ancho': 'minmax(200px,2fr)'},
    {'key': 'campana', 'header': 'Campaña', 'tipo': 'texto', 'ancho': 'minmax(160px,1.4fr)'},
    {'key': 'programa', 'header': 'Programa', 'tipo': 'texto', 'ancho': '150px'},
    {'key': 'gasto', 'header': 'Gastado', 'tipo': 'dinero', 'ancho': '110px'},
]


def registros(desde, hasta, programa):
    """{columnas, filas, resumen}: los anuncios con gasto de las campañas de `programa` (o `sin` = sin etiquetar)."""
    etiquetas = mapa()
    filas = []
    for ad, nombre, campana, campana_id, embudo, monto in _gasto_por_anuncio(desde, hasta):
        suyo = etiquetas.get(campana_id)
        if programa == 'sin' and (suyo is not None or embudo == 'contratacion'):
            continue
        if programa != 'sin' and suyo != programa:
            continue
        filas.append({'id': str(ad), 'anuncio': nombre or 'Sin nombre', 'campana': campana or '—',
                      'programa': ETIQUETAS.get(suyo, 'Sin etiquetar'), 'gasto': round(float(monto or 0), 2)})
    filas.sort(key=lambda f: -f['gasto'])
    resumen = f"{len(filas)} anuncios · ${sum(f['gasto'] for f in filas):,.2f} de Meta"
    return {'columnas': _COLUMNAS, 'filas': filas, 'resumen': resumen}
