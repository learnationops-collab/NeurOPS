"""El material del programa (Learnation Resources) para el Learnito de Work, pedido a la Academia (ADR-W150).

Work no tiene material propio: cuando el cerebro necesita lo que enseña Learnation (por ejemplo, un setter que
pregunta qué decirle a un lead que no arranca a estudiar), se lo pide a la Academia por su conector
(`POST /api/v1/learnito/connector`), que es dueña de ese dato (regla 3 de LEARNITO.md §7).

  · Las herramientas `buscar_material` y `leer_recurso` se toman de la Academia tal cual (`op: tools`): mismo
    nombre y mismos parámetros en los dos Learnito (regla 2), sin copiarlas a mano. Se recuerdan 10 minutos
    porque van en el prefijo con caché del cerebro y no pueden cambiar entre pedidos.
  · Correrlas devuelve lo que devuelve la Academia ({texto, busqueda}): el cerebro muestra la búsqueda.
  · Si la Academia no responde, Learnito de Work sigue sin material (lista vacía, o el error como texto).
"""
import logging
import time

logger = logging.getLogger(__name__)

NOMBRES = ('buscar_material', 'leer_recurso')
VIGENCIA = 600
TIMEOUT = 10
_cache = {'en': 0.0, 'herramientas': None}


def _conector(op, args):
    from app.services.learnation_service import LearnationService
    r = LearnationService._request('POST', '/learnito/connector', timeout=TIMEOUT, json={'op': op, 'args': args})
    if not (r or {}).get('ok'):
        raise RuntimeError((r or {}).get('error') or 'La Academia no respondió')
    return r.get('valor')


def herramientas():
    """Las dos herramientas de material, como las define la Academia. [] si no responde (se reintenta en 1 min)."""
    ahora = time.monotonic()
    if _cache['herramientas'] is not None and ahora - _cache['en'] < VIGENCIA:
        return _cache['herramientas']
    try:
        lista = [t for t in (_conector('tools', {}) or []) if t.get('name') in NOMBRES]
        lista.sort(key=lambda t: NOMBRES.index(t['name']))
    except Exception as e:
        logger.error(f'[LEARNITO] Herramientas de material de la Academia: {e}')
        _cache.update(en=ahora - VIGENCIA + 60, herramientas=_cache['herramientas'] or [])
        return _cache['herramientas']
    _cache.update(en=ahora, herramientas=lista)
    return lista


def correr(nombre, entrada):
    try:
        return _conector('runTool', {'nombre': nombre, 'entrada': entrada or {}}) or {'texto': 'Sin resultados.'}
    except Exception as e:
        logger.error(f'[LEARNITO] {nombre} en la Academia: {e}')
        return {'texto': f'Error: no se pudo consultar el material de la Academia ({e}).'}


def buscar(tema, palabras):
    """`findMaterial` del contrato: lo que usa el cerebro para responder rápido sobre el material."""
    try:
        return _conector('findMaterial', {'tema': tema or '', 'palabras': list(palabras or [])}) or {'results': [], 'more': []}
    except Exception as e:
        logger.error(f'[LEARNITO] findMaterial en la Academia: {e}')
        return {'results': [], 'more': []}
