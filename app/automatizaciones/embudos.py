"""Los embudos del Inbox (ADR-W204): Conversión (el de siempre) y los que se arman aparte (Lead magnet…).

  · Conversión no guarda fases: son las de `fases.py`, y es el único que alimenta el reporte del setter.
    Su Guía son las versiones sin `embudo_id` y sus leads, los `IgContacto` sin `embudo_id`.
  · Los demás traen sus fases ([{id, nombre, tramo}]); los ids no pueden repetir los de Conversión, así el
    reporte nunca cuenta una fase ajena. No lead e In-abrible valen en cualquier embudo.
  · Un lead entra a un embudo cuando arranca un flujo de ese embudo (`motor._iniciar`) o cuando el equipo lo
    mueve a una fase de otro embudo (`api_fases.mover_fase`).
"""
import re
import unicodedata

from app import db
from app.automatizaciones import fases
from app.automatizaciones.modelos import AutEmbudo, ahora

TRAMOS = ('auto', 'manual', 'agenda')
MAX_FASES = 12
_TRAMO_CONVERSION = {'apertura': 'auto', 'link': 'agenda', 'confirmacion': 'agenda'}


class EmbudoInvalido(ValueError):  # noqa: N818  (como GuiaInvalida)
    pass


def _slug(texto, largo):
    t = unicodedata.normalize('NFKD', str(texto or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:largo].strip('-')


def conversion():
    e = AutEmbudo.query.filter_by(slug=AutEmbudo.CONVERSION).first()
    if e is None:  # la migración lo crea; esto cubre una base nueva con create_all
        e = AutEmbudo(slug=AutEmbudo.CONVERSION, nombre='Conversión')
        db.session.add(e)
        db.session.flush()
    return e


def es_conversion(embudo):
    return embudo is None or embudo.slug == AutEmbudo.CONVERSION


def por_slug(slug):
    return conversion() if not slug or slug == AutEmbudo.CONVERSION else AutEmbudo.query.filter_by(slug=slug).first()


def todos():
    conversion()
    return AutEmbudo.query.order_by(AutEmbudo.orden, AutEmbudo.id).all()


def fases_de(embudo):
    """[{id, nombre, tramo}] del embudo, sin las salidas."""
    if es_conversion(embudo):
        return [{'id': f, 'nombre': fases.NOMBRES[f], 'tramo': _TRAMO_CONVERSION.get(f, 'manual')} for f in fases.EMBUDO]
    return list(embudo.fases or [])


def ids_de(embudo):
    """Las fases que valen en el embudo, salidas incluidas."""
    return tuple(f['id'] for f in fases_de(embudo)) + fases.SALIDAS


def de_contacto(contacto):
    """El embudo del lead (Conversión si no tiene)."""
    if contacto.embudo_id:
        e = db.session.get(AutEmbudo, contacto.embudo_id)
        if e is not None:
            return e
    return conversion()


def id_guardado(embudo):
    """Lo que va en `embudo_id` de contactos y guías: None para Conversión."""
    return None if es_conversion(embudo) else embudo.id


def mover_a(contacto, embudo, fase=None):
    """Deja al lead en el embudo. Al cambiar de embudo, la fase vieja no sirve: queda la dada (o ninguna)."""
    nuevo = id_guardado(embudo)
    if contacto.embudo_id != nuevo:
        contacto.embudo_id = nuevo
        contacto.fase = fase
    elif fase:
        contacto.fase = fase


def al_arrancar(contacto, flujo):
    """El lead queda en el embudo del flujo que arrancó (Conversión si el flujo no tiene), en su fase."""
    if flujo is None:
        return
    if not flujo.embudo_id:
        if contacto.embudo_id:
            mover_a(contacto, conversion())
        return
    e = db.session.get(AutEmbudo, flujo.embudo_id)
    if e is not None:
        mover_a(contacto, e, flujo.fase or (fases_de(e) or [{}])[0].get('id'))


def _validar_fases(lista):
    if not isinstance(lista, list) or not lista:
        raise EmbudoInvalido('El embudo necesita al menos una fase')
    if len(lista) > MAX_FASES:
        raise EmbudoInvalido(f'Un embudo admite hasta {MAX_FASES} fases')
    salida, vistos = [], set(fases.TODAS)
    for f in lista:
        nombre = str((f or {}).get('nombre') or '').strip()[:40]
        if not nombre:
            raise EmbudoInvalido('Hay una fase sin nombre')
        fid = str(f.get('id') or '').strip()[:20] or _slug(nombre, 20)
        if not re.match(r'^[a-z0-9-]{1,20}$', fid) or fid in vistos:
            fid = f'{_slug(nombre, 16) or "fase"}-{len(salida) + 1}'
        if fid in vistos:
            raise EmbudoInvalido(f'La fase «{nombre}» se repite')
        vistos.add(fid)
        salida.append({'id': fid, 'nombre': nombre, 'tramo': f.get('tramo') if f.get('tramo') in TRAMOS else 'manual'})
    return salida


def _variables(v):
    if not isinstance(v, dict):
        raise EmbudoInvalido('Las variables vinieron mal armadas')
    salida = {}
    for k, valor in list(v.items())[:20]:
        clave = _slug(k, 40).replace('-', '_')
        if clave and clave not in ('nombre', 'usuario'):
            salida[clave] = str(valor or '').strip()[:500]
    return salida


def crear(datos):
    nombre = str(datos.get('nombre') or '').strip()[:80]
    if not nombre:
        raise EmbudoInvalido('El embudo necesita un nombre')
    base = _slug(nombre, 34) or 'embudo'
    slug, n = base, 1
    while AutEmbudo.query.filter_by(slug=slug).first():
        n += 1
        slug = f'{base}-{n}'
    orden = (db.session.query(db.func.max(AutEmbudo.orden)).scalar() or 0) + 1
    e = AutEmbudo(slug=slug, nombre=nombre, descripcion=str(datos.get('descripcion') or '').strip()[:400] or None,
                  fases=_validar_fases(datos.get('fases') or [{'nombre': 'Entrega', 'tramo': 'auto'}]),
                  variables={}, orden=orden)
    db.session.add(e)
    db.session.flush()
    return e


def actualizar(embudo, datos, puede_activar):
    if 'nombre' in datos:
        nombre = str(datos.get('nombre') or '').strip()[:80]
        if not nombre:
            raise EmbudoInvalido('El embudo necesita un nombre')
        embudo.nombre = nombre
    if 'descripcion' in datos:
        embudo.descripcion = str(datos.get('descripcion') or '').strip()[:400] or None
    if 'fases' in datos:
        if es_conversion(embudo):
            raise EmbudoInvalido('Las fases de Conversión son las del setting: cambiarlas se propone')
        embudo.fases = _validar_fases(datos['fases'])
    if 'variables' in datos:
        embudo.variables = _variables(datos['variables'])
    if 'seguimientos_activos' in datos:
        if not puede_activar:
            raise PermissionError('Prender o apagar los seguimientos automáticos lo hace la dirección comercial')
        prender = bool(datos['seguimientos_activos'])
        if prender and not embudo.seguimientos_activos:
            embudo.seguimientos_desde = ahora()  # el candado: solo las conversaciones que empiecen desde ahora
        embudo.seguimientos_activos = prender


def resumen(embudo, leads=None):
    return {'id': embudo.slug, 'pk': None if es_conversion(embudo) else embudo.id, 'nombre': embudo.nombre, 'descripcion': embudo.descripcion,
            'conversion': es_conversion(embudo), 'fases': fases_de(embudo), 'variables': embudo.variables or {},
            'seguimientos_activos': bool(embudo.seguimientos_activos),
            'seguimientos_desde': embudo.seguimientos_desde.isoformat() + 'Z' if embudo.seguimientos_desde else None,
            'leads': leads}
