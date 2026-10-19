"""Campañas de marketing: varias palabras clave → un flujo, con vigencia (17/10/2026).

Reemplaza al trigger por palabra de ManyChat: la campaña junta sus palabras clave y las manda a un
flujo; varias campañas pueden compartir flujo. Una palabra se puede REUSAR con otro significado en
otra campaña, pero nunca en dos campañas con vigencias que se pisan: si no, un DM no sabría a qué
flujo ir. La vigencia es de la campaña entera, [desde, hasta).

Vive en paralelo a Marketing: no crea `Ad` ni toca el mapeo de Meta ni el webhook de ManyChat. Usa la
misma normalización que Marketing (`clave_de_palabra`) para poder cruzarse con ella el día del cambio.
"""
from app import db
from app.automatizaciones.modelos import AutCampana, AutCampanaMeta, AutCampanaPalabra, AutFlujo
from app.models.marketing import clave_de_palabra

LARGO_PALABRA = 100


class ErrorDeCampana(ValueError):
    pass


def vigente(campana, momento):
    return campana.desde <= momento and (campana.hasta is None or momento < campana.hasta)


def _se_pisan(a_desde, a_hasta, b_desde, b_hasta):
    return (b_hasta is None or a_desde < b_hasta) and (a_hasta is None or b_desde < a_hasta)


def campana_de(texto, momento):
    """(campaña, clave) de un mensaje que es exactamente una palabra clave vigente, o (None, clave)."""
    clave = clave_de_palabra(texto)
    if not clave:
        return None, None
    candidatas = (AutCampana.query.join(AutCampanaPalabra)
                  .filter(AutCampanaPalabra.clave == clave, AutCampana.desde <= momento,
                          db.or_(AutCampana.hasta.is_(None), AutCampana.hasta > momento))
                  .order_by(AutCampana.id).all())
    return (candidatas[0] if candidatas else None), clave


def _palabras(valores):
    """{clave: texto} sin repetidas; error si alguna no deja nada al normalizarla."""
    if not isinstance(valores, list):
        raise ErrorDeCampana('Las palabras clave tienen que ser una lista')
    salida = {}
    for valor in valores:
        texto = valor.strip()[:LARGO_PALABRA] if isinstance(valor, str) else ''
        clave = clave_de_palabra(texto)
        if not clave:
            raise ErrorDeCampana(f'«{valor}» no es una palabra clave válida')
        salida.setdefault(clave, texto)
    return salida


def conflictos(claves, desde, hasta, excluir_id=None):
    """[(clave, campaña)] de las palabras que ya están en otra campaña con vigencia que se pisa."""
    if not claves:
        return []
    filas = (db.session.query(AutCampanaPalabra.clave, AutCampana)
             .join(AutCampana, AutCampana.id == AutCampanaPalabra.campana_id)
             .filter(AutCampanaPalabra.clave.in_(list(claves))))
    if excluir_id:
        filas = filas.filter(AutCampana.id != excluir_id)
    return [(clave, otra) for clave, otra in filas.all() if _se_pisan(desde, hasta, otra.desde, otra.hasta)]


def guardar(campana, datos):
    """Crea o edita la campaña con lo que manda la API. Valida todo antes de tocar la fila; no hace commit."""
    nombre = (datos.get('nombre', campana.nombre) or '').strip()[:150]
    if not nombre:
        raise ErrorDeCampana('La campaña necesita un nombre')
    embudo = datos.get('embudo', campana.embudo or 'setting')
    if embudo not in AutCampana.EMBUDOS:
        raise ErrorDeCampana('El embudo tiene que ser setting, workshop, vsl u otro')
    tipo = datos.get('tipo', campana.tipo or 'pago')
    if tipo not in AutCampana.TIPOS:
        raise ErrorDeCampana('El tipo tiene que ser pago u organico')
    desde, hasta = datos.get('desde', campana.desde), datos.get('hasta', campana.hasta)
    if desde is None:
        raise ErrorDeCampana('La campaña necesita una fecha de inicio')
    if hasta is not None and hasta <= desde:
        raise ErrorDeCampana('La campaña tiene que terminar después de empezar')
    flujo_id = datos.get('flujo_id', campana.flujo_id)
    if flujo_id is not None and (isinstance(flujo_id, bool) or not isinstance(flujo_id, int)
                                 or db.session.get(AutFlujo, flujo_id) is None):
        raise ErrorDeCampana('Ese flujo no existe')

    palabras = _palabras(datos['palabras']) if 'palabras' in datos \
        else {p.clave: p.texto for p in campana.palabras}
    choques = conflictos(palabras, desde, hasta, excluir_id=campana.id)
    if choques:
        detalle = ', '.join(sorted(f'{clave} ({otra.nombre})' for clave, otra in choques))
        raise ErrorDeCampana(f'Estas palabras ya están en otra campaña vigente en esas fechas: {detalle}')

    meta = datos.get('campanas_meta')
    if meta is not None and (not isinstance(meta, list) or not all(isinstance(m, str) and m.strip() for m in meta)):
        raise ErrorDeCampana('Las campañas de Meta tienen que ser una lista de ids')

    campana.nombre, campana.embudo, campana.tipo = nombre, embudo, tipo
    campana.desde, campana.hasta, campana.flujo_id = desde, hasta, flujo_id
    if 'palabras' in datos:
        actuales = {p.clave: p for p in campana.palabras}
        campana.palabras = [actuales.get(clave) or AutCampanaPalabra(clave=clave, texto=texto)
                            for clave, texto in palabras.items()]
    if meta is not None:
        actuales = {m.meta_campana_id: m for m in campana.campanas_meta}
        ids = list(dict.fromkeys(m.strip()[:40] for m in meta))
        campana.campanas_meta = [actuales.get(i) or AutCampanaMeta(meta_campana_id=i) for i in ids]
    return campana


def resumen(campana, momento):
    return {
        'id': campana.id,
        'nombre': campana.nombre,
        'embudo': campana.embudo,
        'tipo': campana.tipo,
        'flujo_id': campana.flujo_id,
        'flujo': campana.flujo.nombre if campana.flujo else None,
        'desde': campana.desde.isoformat() + 'Z',
        'hasta': campana.hasta.isoformat() + 'Z' if campana.hasta else None,
        'vigente': vigente(campana, momento),
        'palabras': [p.texto for p in campana.palabras],
        'campanas_meta': [m.meta_campana_id for m in campana.campanas_meta],
    }
