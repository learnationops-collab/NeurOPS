"""Consultas sobre las colecciones. Port de core/datos.js.
`d` es {funnels, formularios, personas, grupos, eventos, roles}: listas de documentos normalizados.
"""

import re
import unicodedata
from functools import cmp_to_key

from app.agendas_v2.nucleo.catalogos import COLORES, TZ_DEF, a_min
from app.agendas_v2.nucleo.normalizar import franjas
from app.agendas_v2.nucleo.util import js_str, js_truthy, mayus


def buscar(d, col, id):
    if not js_truthy(id):
        return None
    return next((x for x in d.get(col) or [] if x.get('id') == id), None)


def _clave_texto(s):
    """Aproximación de String.prototype.localeCompare (colación ICU en español): primero las letras
    sin tildes ni mayúsculas (la ñ va después de la n), después las tildes, por último las mayúsculas."""
    base, tildes, caso = [], [], []
    for c in s:
        d = unicodedata.normalize('NFD', c)
        b = ''.join(x for x in d if not unicodedata.combining(x))
        extra = 1 if c in 'ñÑ' else 0
        for x in b.casefold() or c:
            clase = 2 if x.isalpha() else 1 if x.isdigit() else 0
            base.append((clase, x, extra))
        tildes.append(''.join(x for x in d if unicodedata.combining(x) and c not in 'ñÑ'))
        caso.append(0 if c == c.lower() else 1)
    return (base, tildes, caso)


def comparar_texto(a, b):
    ka, kb = _clave_texto(a), _clave_texto(b)
    return (ka > kb) - (ka < kb)


def ordenados(d, col):
    """`ord(d, col)` del JS: por `orden` y, a igual orden, por nombre."""

    def cmp(a, b):
        r = (a.get('orden') or 0) - (b.get('orden') or 0)
        return r if r else comparar_texto(js_str(a.get('nombre')), js_str(b.get('nombre')))

    return sorted(d.get(col) or [], key=cmp_to_key(cmp))


def max_orden(d, col):
    return max([0] + [f.get('orden') or 0 for f in d.get(col) or []])


def sesion_de(p, evento_id, duracion, margen):
    """(duración, margen) en minutos de las sesiones de ese closer en ese evento: lo que él ajustó o, si
    no ajustó, la propuesta del evento (duracion, margen)."""
    propia = ((p or {}).get('sesiones') or {}).get(evento_id) or {} if evento_id else {}
    return propia.get('duracion', duracion), propia.get('margen', margen or 0)


def es_closer(d, p):
    """Un rol que "toma llamadas" es closer; sin roles cargados, vale el id clásico."""
    r = buscar(d, 'roles', p.get('rol'))
    return r['atiende'] if r else p.get('rol') == 'closer'


def closers(d):
    return [p for p in ordenados(d, 'personas') if es_closer(d, p)]


def setters(d):
    def es(p):
        r = buscar(d, 'roles', p.get('rol'))
        return bool(re.search('setter', js_str(r['nombre']), re.I)) if r else p.get('rol') == 'setter'

    return [p for p in ordenados(d, 'personas') if es(p)]


def nombre_rol(d, id):
    r = buscar(d, 'roles', id)
    return r['nombre'] if r else mayus(id) if js_truthy(id) else ''


def nombre_grupo(d, id):
    g = buscar(d, 'grupos', id)
    return g['nombre'] if g else 'sin prioridad'


def color_var(k):
    return 'var(--fc-' + (k if k in COLORES else 'azul') + ')'


def color_rol(r):
    if r and r.get('color'):
        return color_var(r['color'])
    return 'var(--success)' if r and r.get('atiende') else 'var(--info)'


def color_libre(d, col):
    us = [f.get('color') for f in d.get(col) or []]
    return next((c for c in COLORES if c not in us), COLORES[len(d.get(col) or []) % len(COLORES)])


def rol_closer(d):
    """Rol de closer para sumar personas desde Team: el primero que atiende llamadas, o el id clásico."""
    r = next((x for x in ordenados(d, 'roles') if x.get('atiende')), None)
    return r['id'] if r else 'closer'


def horas_semana(p):
    m = 0
    for dd in range(7):
        for r in franjas(p.get('horario'), dd):
            m += max(0, a_min(r[1]) - a_min(r[0]))
    return m / 60


def tz_equipo(cs):
    """La zona más común del equipo: la que usa la vista de cobertura."""
    c = {}
    for p in cs:
        c[p['tz']] = c.get(p['tz'], 0) + 1
    ks = sorted(c, key=lambda k: -c[k])
    return ks[0] if ks else TZ_DEF


def nombre_origen(d, o):
    """Nombre que se muestra para un origen de funnel (el de su setter, si tiene)."""
    p = buscar(d, 'personas', o.get('setter')) if o.get('setter') else None
    return p['nombre'] if p else o.get('nombre')
