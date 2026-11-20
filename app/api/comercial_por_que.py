"""Por qué compran y por qué no (ADR-W187): el corte «Respuesta» del panel Segmentos y el panel nuevo de Analizar.

- `/segmentos/respuestas`: cuánto compra cada opción del formulario de agenda (`segmentos_respuestas`). No sigue el
  período del dashboard (ver ese módulo). Se guarda unos minutos: recorre todos los clientes con formulario.
- `/segmentos/respuestas/personas?q=&op=`: quiénes eligieron esa opción. Solo la dirección: son leads de todos.
- `/por-que-compran`: el cruce de quién decide con si puede invertir, y las objeciones de las llamadas que no
  cerraron en el período y el alcance del dashboard, agrupadas (`objeciones_categorias`).
"""
import time

from flask import jsonify, request

from app.api.comercial import _alcance, _rangos, _solo_direccion, bp
from app.services import comercial_no_cerradas, objeciones_categorias, segmentos_respuestas
from app.services.comercial_service import ROL_CLOSERS

_CACHE = {'en': 0, 'datos': None}
_DURA = 15 * 60


def _resumen():
    if not _CACHE['datos'] or time.time() - _CACHE['en'] > _DURA:
        _CACHE['datos'], _CACHE['en'] = segmentos_respuestas.resumen(), time.time()
    return _CACHE['datos']


@bp.route('/segmentos/respuestas', methods=['GET'])
def segmentos_respuestas_panel():
    return jsonify({**_resumen(), 'puede_ver_personas': _solo_direccion()}), 200


@bp.route('/segmentos/respuestas/personas', methods=['GET'])
def segmentos_respuestas_personas():
    if not _solo_direccion():
        return jsonify({'message': 'Forbidden'}), 403
    q, op = request.args.get('q', ''), request.args.get('op', '')
    if not q or not op:
        return jsonify({'error': 'Faltan la pregunta y la opción.'}), 400
    return jsonify({'personas': segmentos_respuestas.personas_de(q, op)}), 200


@bp.route('/por-que-compran', methods=['GET'])
def por_que_compran():
    rol, miembro_id, _ = _alcance()
    if rol != ROL_CLOSERS:
        return jsonify({'error': 'Este panel es del tablero de closers.'}), 400
    start, end, _p, _q = _rangos()
    filas = comercial_no_cerradas.no_cerradas(start, end, miembro_id)
    r = _resumen()
    return jsonify({'objeciones': objeciones_categorias.agrupar(filas), 'cruce': r['cruce'],
                    'promedio': r['pct'], 'desde': r['desde']}), 200
