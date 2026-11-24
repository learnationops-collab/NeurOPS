"""Los kpis del día con su promedio de los 7 días anteriores y la serie corta (spark).

Un día anterior sale de la fila guardada del rol si la hay; si no, se calcula y se guarda en memoria
unos minutos (el autosave pide el día entero cada vez que la persona escribe).
"""
import logging
import time
from datetime import timedelta

from app import db

logger = logging.getLogger(__name__)

TTL = 600
_CACHE = {}


def _calculado(user, rol, modulo, dia):
    clave = (user.id, rol, dia)
    hit = _CACHE.get(clave)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]
    try:
        ctx = modulo.contexto(user, dia) if getattr(modulo, 'AUTO_USA_CONTEXTO', True) else {}
        valores = modulo.kpis_de(modulo.auto(user, dia, ctx))
    except Exception as e:
        logger.error(f"[reporte] kpis de {user.id} {rol} {dia}: {e}")
        db.session.rollback()
        valores = {}
    if len(_CACHE) > 2000:
        _CACHE.clear()
    _CACHE[clave] = (time.time(), valores)
    return valores


def previos(user, rol, modulo, dia, n=7):
    """[{clave: v}] de los `n` días anteriores a `dia`, del más viejo al más nuevo."""
    desde = dia - timedelta(days=n)
    filas = modulo.filas_rango(user, desde, dia - timedelta(days=1))
    salida = []
    for k in range(n, 0, -1):
        d = dia - timedelta(days=k)
        row = filas.get(d)
        salida.append(modulo.kpis_de(modulo.valores_de_fila(row)) if row is not None
                      else _calculado(user, rol, modulo, d))
    return salida


def kpis(user, rol, modulo, dia, vals):
    hoy = modulo.kpis_de(vals)
    antes = previos(user, rol, modulo, dia)
    metas = modulo.meta_de(vals) if hasattr(modulo, 'meta_de') else {}
    salida = []
    for clave, l, f in modulo.KPIS:
        serie = [p.get(clave) for p in antes]
        cargados = [x for x in serie if x is not None]
        item = {'clave': clave, 'l': l, 'v': hoy.get(clave), 'f': f,
                'prom': round(sum(cargados) / len(cargados), 1) if cargados else None}
        if clave in metas:
            item['meta'] = metas[clave]
        else:
            item['spark'] = [x or 0 for x in serie[1:]] + [hoy.get(clave) or 0]
        salida.append(item)
    return salida
