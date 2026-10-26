"""Segmento A/B/C/D del lead (docs/plan_segmentos_triage.md §8 y §8.9). Port de core/segmento.js.

Dos modos, según `form.segmento.modo`:
  - 'suma' (desde 2026-12): cada opción tiene `puntosSeg` (-5 a +5, sacados de los datos: 0 = el lead promedio,
    lo que resta compra menos). El puntaje es la suma de lo respondido; una respuesta que falta suma 0 (el
    promedio). Cortes en puntos: A ≥ a, B ≥ b, C ≥ c.
  - proporción (el de antes): puntos obtenidos ÷ máximo posible de lo respondido, cortes en %.
La confianza es la probabilidad de caer en ese segmento si los puntos tienen un error normal de `sigma`.
"""

import math

from app.agendas_v2.nucleo.catalogos import con_opciones
from app.agendas_v2.nucleo.util import js_round, num

SEGMENTOS = ('A', 'B', 'C', 'D')
# Pregunta virtual del ruteo: una regla puede pedir «Segmento es A o B» ({'q': SEG_Q, 'ops': ['A', 'B']}).
SEG_Q = '__segmento'


def _fi(x):
    """Distribución normal acumulada. erf con la aproximación de Abramowitz y Stegun (7.1.26), la misma
    que en JS (que no tiene erf), así los dos lados dan igual."""
    if x == math.inf:
        return 1.0
    if x == -math.inf:
        return 0.0
    z = abs(x) / math.sqrt(2)
    t = 1 / (1 + 0.3275911 * z)
    erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * math.exp(-z * z)
    return 0.5 * (1 + (erf if x >= 0 else -erf))


def _banda(seg, a, b, c):
    """[desde, hasta) del puntaje de ese segmento."""
    return {'A': (a, math.inf), 'B': (b, a), 'C': (c, b), 'D': (-math.inf, c)}[seg]


def pregunta_segmento(form):
    """La pregunta virtual del ruteo si el formulario segmenta; None si no."""
    if not ((form or {}).get('segmento') or {}).get('activo'):
        return None
    return {'id': SEG_Q, 'tipo': 'opciones', 'titulo': 'Segmento del lead',
            'opciones': [{'id': s, 'texto': 'Segmento ' + s} for s in SEGMENTOS]}


def _elegida(q, resp):
    return next((x for x in q.get('opciones') or [] if x.get('id') == resp.get(q['id'])), None)


def _suma(form, resp, cfg):
    total = respondidas = faltan = 0
    for q in form.get('preguntas') or []:
        if not q.get('segmento') or not con_opciones(q.get('tipo')):
            continue
        if all(o.get('puntosSeg') is None for o in q.get('opciones') or []):
            continue
        o = _elegida(q, resp)
        if o is None or o.get('puntosSeg') is None:
            if q['segmento'] == 'clave':
                return None
            faltan += 1
            continue
        total += o['puntosSeg']
        respondidas += 1
    if not respondidas:
        return None
    # Los puntos son enteros: el corte cae a mitad de camino. Lo que falta tiene el doble de error.
    a, b, c = cfg['a'] - 0.5, cfg['b'] - 0.5, cfg['c'] - 0.5
    sigma = cfg['sigma'] * math.sqrt(respondidas + 4 * faltan)
    return total, respondidas, (a, b, c), sigma


def _proporcion(form, resp, cfg):
    obtenido = maximo = respondidas = 0
    for q in form.get('preguntas') or []:
        if not q.get('segmento') or not con_opciones(q.get('tipo')):
            continue
        tope = max((o['puntos'] for o in q.get('opciones') or [] if o.get('puntos') is not None), default=None)
        o = _elegida(q, resp)
        if o is None or o.get('puntos') is None or not tope:
            if q['segmento'] == 'clave':
                return None
            continue
        obtenido += o['puntos']
        maximo += tope
        respondidas += 1
    if not maximo:
        return None
    return obtenido / maximo, respondidas, (cfg['a'] / 100, cfg['b'] / 100, cfg['c'] / 100), cfg['sigma'] / 100


def segmentar(form, resp):
    """{segmento, puntos, preguntas, confianza, version} o None si el formulario no segmenta o falta
    una respuesta clave. `resp`: {pregunta_id: opcion_id}."""
    cfg = (form or {}).get('segmento') or {}
    if not cfg.get('activo'):
        return None
    r = (_suma if cfg.get('modo') == 'suma' else _proporcion)(form, resp or {}, cfg)
    if r is None:
        return None
    puntos, respondidas, cortes, sigma = r
    seg = next(s for s in SEGMENTOS if puntos >= _banda(s, *cortes)[0])
    desde, hasta = _banda(seg, *cortes)
    confianza = _fi((hasta - puntos) / sigma) - _fi((desde - puntos) / sigma)
    return {
        'segmento': seg,
        'puntos': num(js_round(puntos * 10000) / 10000),
        'preguntas': respondidas,
        'confianza': js_round(confianza * 1000) / 1000,
        'version': cfg.get('version') or '',
    }
