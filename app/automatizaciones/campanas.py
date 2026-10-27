"""Campañas de marketing: varias palabras clave → un flujo, con vigencia (17/10/2026).

Reemplaza al trigger por palabra de ManyChat: la campaña junta sus palabras clave y las manda a un
flujo; varias campañas pueden compartir flujo. Una palabra se puede REUSAR con otro significado en
otra campaña, pero nunca en dos campañas con vigencias que se pisan: si no, un DM no sabría a qué
flujo ir. La vigencia es de la campaña entera, [desde, hasta).

Vive en paralelo a Marketing: no crea `Ad` ni toca el mapeo de Meta ni el webhook de ManyChat. Usa la
misma normalización que Marketing (`clave_de_palabra`) para poder cruzarse con ella el día del cambio.

Una palabra vigente siempre tiene un flujo que corre (27/10/2026): la campaña vigente o futura con
palabras no se guarda apuntando a un flujo en borrador, pausado o a ninguno, y un flujo no se pausa
mientras lo use una (`que_lo_usan`). El 27/10 QUIERO APLICAR quedó sin flujo una noche y 14 leads no
recibieron nada.
"""
from app import db
from app.automatizaciones.modelos import AutCampana, AutCampanaMeta, AutCampanaPalabra, AutCampanaSetter, AutFlujo, ahora
from app.automatizaciones.reparto import setters_activos
from app.models.marketing import clave_de_palabra

LARGO_PALABRA = 100
MAX_PESO = 100


class ErrorDeCampana(ValueError):
    pass


def vigente(campana, momento):
    return campana.desde <= momento and (campana.hasta is None or momento < campana.hasta)


def corre(flujo):
    """¿El flujo atiende mensajes? Activo y con una versión publicada (lo mismo que pide el motor)."""
    return flujo is not None and flujo.estado == AutFlujo.ACTIVO and flujo.version_publicada_id is not None


def _sin_terminar(hasta, momento):
    return hasta is None or hasta > momento


def que_lo_usan(flujo, momento=None):
    """Las campañas vigentes o futuras con palabras que llevan a ese flujo."""
    momento = momento or ahora()
    return [c for c in AutCampana.query.filter(AutCampana.flujo_id == flujo.id).order_by(AutCampana.id).all()
            if c.palabras and _sin_terminar(c.hasta, momento)]


def _exigir_flujo_que_corre(flujo_id, palabras, hasta):
    if not palabras or not _sin_terminar(hasta, ahora()):
        return
    flujo = db.session.get(AutFlujo, flujo_id) if flujo_id is not None else None
    if flujo is None:
        raise ErrorDeCampana('Una campaña vigente con palabras clave necesita un flujo: si no, quien escriba '
                             'la palabra no recibe nada')
    if not corre(flujo):
        estado = 'en borrador' if flujo.version_publicada_id is None else flujo.estado
        raise ErrorDeCampana(f'El flujo «{flujo.nombre}» no está corriendo ({estado}): publicalo y activalo '
                             'antes de mandarle palabras clave')


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


def _participante(fila, user_id, pesos):
    """La fila del setter en la campaña, con el peso que mandó la API (o el que ya tenía, o 1)."""
    fila = fila or AutCampanaSetter(user_id=user_id, peso=1)
    if pesos and str(user_id) in pesos:
        fila.peso = pesos[str(user_id)]
    return fila


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
    _exigir_flujo_que_corre(flujo_id, palabras, hasta)

    meta = datos.get('campanas_meta')
    if meta is not None and (not isinstance(meta, list) or not all(isinstance(m, str) and m.strip() for m in meta)):
        raise ErrorDeCampana('Las campañas de Meta tienen que ser una lista de ids')
    reparto = datos.get('reparto', campana.reparto or 'distribuido')
    if reparto not in AutCampana.REPARTOS:
        raise ErrorDeCampana('El reparto tiene que ser distribuido o sin_reparto')
    setters = datos.get('setters')
    if setters is not None:
        validos = {u.id for u in setters_activos()}
        if not isinstance(setters, list) or not all(isinstance(s, int) and s in validos for s in setters):
            raise ErrorDeCampana('Los setters del reparto tienen que ser setters activos')
    pesos = datos.get('pesos')
    if pesos is not None and not (isinstance(pesos, dict) and all(
            isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= MAX_PESO for v in pesos.values())):
        raise ErrorDeCampana(f'El peso de cada setter tiene que ser un número entero entre 1 y {MAX_PESO}')

    campana.nombre, campana.embudo, campana.tipo = nombre, embudo, tipo
    campana.desde, campana.hasta, campana.flujo_id = desde, hasta, flujo_id
    campana.reparto = reparto
    campana.solo_conectados = bool(datos.get('solo_conectados', campana.solo_conectados or False))
    if setters is not None or pesos is not None:
        actuales = {s.user_id: s for s in campana.setters}
        campana.setters = [_participante(actuales.get(i), i, pesos)
                           for i in dict.fromkeys(setters if setters is not None else actuales)]
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
        'reparto': campana.reparto,
        'solo_conectados': bool(campana.solo_conectados),
        'setters': [s.user_id for s in campana.setters],
        'pesos': {str(s.user_id): s.peso or 1 for s in campana.setters},
    }
