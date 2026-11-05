"""Las series de reuniones (la reunión recurrente de cada nota) y la categoría elegida para cada una.
Lo usan Integraciones (app/api/notas_meet.py) y la Academia (app/api/external/notas_meet.py)."""
from sqlalchemy import func

from app import db
from app.models import MeetingNote
from app.services.notas_meet import categorias, conexion, sincronizar


def listar():
    """[{serie, notas, ultima, categorias: {cat: n}, regla}], la que tiene más notas primero."""
    filas = (db.session.query(MeetingNote.series, MeetingNote.category, func.count(), func.max(MeetingNote.meeting_at))
             .group_by(MeetingNote.series, MeetingNote.category).all())
    reglas = conexion.reglas()
    por = {}
    for serie, categoria, n, ultima in filas:
        s = por.setdefault(serie, {'serie': serie, 'notas': 0, 'ultima': None, 'categorias': {}, 'regla': reglas.get(serie)})
        s['notas'] += n
        s['categorias'][categoria or 'other'] = n
        if ultima and (not s['ultima'] or ultima > s['ultima']):
            s['ultima'] = ultima
    lista = sorted(por.values(), key=lambda s: (-s['notas'], s['serie'] or ''))
    for s in lista:
        s['ultima'] = s['ultima'].isoformat() + 'Z' if s['ultima'] else None
    return lista


def elegir(serie, categoria):
    """Fija (o, con None, saca) la categoría de la serie y recategoriza sus notas. ValueError si no existe."""
    if categoria and categoria not in categorias.CATEGORIAS:
        raise ValueError(f'categoría desconocida: {categoria}')
    if not serie:
        raise ValueError('falta la serie')
    conexion.guardar_regla(serie, categoria)
    return sincronizar.reclasificar(serie)


def elegir_nota(nota, categoria):
    """Categoría a mano para una nota; None la devuelve a la automática."""
    if categoria and categoria not in categorias.CATEGORIAS:
        raise ValueError(f'categoría desconocida: {categoria}')
    nota.category_manual = bool(categoria)
    if categoria:
        nota.category = categoria
    else:
        categorias.clasificar(nota, conexion.reglas())
    db.session.commit()
    return nota
