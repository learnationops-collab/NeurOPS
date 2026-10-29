"""Cortes y comparación de las vistas de Segmentos (Marketing y Closing), con UNA sola cuenta (Kerwin, 28/10/2026).

Las dos vistas parten sus filas por segmento (A/B/C/D/sin) y ahora también por otra cosa —closer, fuente, origen,
setter— y las comparan con otro período. Lo que es igual en las dos vive acá, para que una cifra no se calcule
dos veces ni de dos maneras:

  · `separar`     parte los hechos (agendas, cobros, leads) en grupos por la clave de su corte.
  · `claves`      el orden de los grupos de uno o dos períodos (la unión: un closer que solo estuvo en uno aparece igual).
  · `con_previo`  le pega a cada cifra de una fila la del período de comparación y su diferencia.

Un «hecho» es un dict con `seg` (A/B/C/D/sin) y lo que cada vista necesite; los grupos suman siempre el total.
"""
from collections import defaultdict

SIN_GRUPO = 'Sin dato'


def separar(hechos, clave_de):
    """{clave del grupo: [hechos]} en el orden en que aparecen."""
    salida = defaultdict(list)
    for h in hechos:
        salida[clave_de(h)].append(h)
    return dict(salida)


def claves(*separados, fijo=()):
    """Las claves de uno o varios `separar` (el actual y el comparado), unidas: primero las de `fijo` que existan, el resto
    de más a menos hechos y lo «sin dato» al final."""
    peso = defaultdict(int)
    for s in separados:
        for k, hs in s.items():
            peso[k] += len(hs)
    primeras = [k for k in fijo if k in peso]
    resto = sorted((k for k in peso if k not in primeras), key=lambda k: (k.startswith('Sin '), -peso[k], k))
    return primeras + resto


def diferencia(valor, previo):
    """{abs, pct} de `valor` contra `previo`: None si falta alguno; `pct` None si el anterior era 0 (no hay base)."""
    if valor is None or previo is None:
        return None
    d = round(valor - previo, 2)
    return {'abs': d, 'pct': round(d * 100 / abs(previo), 1) if previo else None}


def con_previo(fila, previa, campos):
    """`fila` con `previo` (las cifras del período de comparación) y `delta` (la diferencia de cada una)."""
    return {**fila, 'previo': {c: previa.get(c) for c in campos},
            'delta': {c: diferencia(fila.get(c), previa.get(c)) for c in campos}}


def unir_comparacion(grupos, previos, campos):
    """Pega el período comparado a cada fila y al total de cada grupo. `grupos` y `previos` traen los MISMOS grupos y
    segmentos, en el mismo orden (se armaron con la unión de claves)."""
    salida = []
    for g, p in zip(grupos, previos):
        filas = [con_previo(f, pf, campos) for f, pf in zip(g['filas'], p['filas'])]
        salida.append({**g, 'filas': filas, 'total': con_previo(g['total'], p['total'], campos)})
    return salida
