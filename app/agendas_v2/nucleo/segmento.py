"""Segmento A/B/C/D del lead (docs/plan_segmentos_triage.md §8). Port de core/segmento.js.

Puntaje = puntos obtenidos ÷ máximo posible de las preguntas del segmento que respondió: una respuesta
que falta no cuenta como 0. Los cortes y la incertidumbre de los puntos vienen del formulario
(`form.segmento`); la confianza es la probabilidad de caer en ese segmento si los puntos tienen un
error normal de `sigma`.
"""

import math

from app.agendas_v2.nucleo.catalogos import con_opciones
from app.agendas_v2.nucleo.util import js_round

SEGMENTOS = ('A', 'B', 'C', 'D')


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


def _banda(seg, cfg):
    """[desde, hasta) del puntaje de ese segmento, en 0..1."""
    a, b, c = cfg['a'] / 100, cfg['b'] / 100, cfg['c'] / 100
    return {'A': (a, math.inf), 'B': (b, a), 'C': (c, b), 'D': (-math.inf, c)}[seg]


def segmentar(form, resp):
    """{segmento, puntos, preguntas, confianza, version} o None si el formulario no segmenta o falta
    una respuesta clave. `resp`: {pregunta_id: opcion_id}."""
    cfg = (form or {}).get('segmento') or {}
    if not cfg.get('activo'):
        return None
    obtenido = maximo = respondidas = 0
    for q in form.get('preguntas') or []:
        if not q.get('segmento') or not con_opciones(q.get('tipo')):
            continue
        tope = max((o['puntos'] for o in q.get('opciones') or [] if o.get('puntos') is not None), default=None)
        o = next((x for x in q.get('opciones') or [] if x.get('id') == resp.get(q['id'])), None)
        if o is None or o.get('puntos') is None or not tope:
            if q['segmento'] == 'clave':
                return None
            continue
        obtenido += o['puntos']
        maximo += tope
        respondidas += 1
    if not maximo:
        return None
    puntos = obtenido / maximo
    seg = next(s for s in SEGMENTOS if puntos >= _banda(s, cfg)[0])
    desde, hasta = _banda(seg, cfg)
    sigma = cfg['sigma'] / 100
    confianza = _fi((hasta - puntos) / sigma) - _fi((desde - puntos) / sigma)
    return {
        'segmento': seg,
        'puntos': js_round(puntos * 10000) / 10000,
        'preguntas': respondidas,
        'confianza': js_round(confianza * 1000) / 1000,
        'version': cfg.get('version') or '',
    }
