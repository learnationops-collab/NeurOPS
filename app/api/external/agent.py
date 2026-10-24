"""Agentes pares: la Academia le pide un dato a Work sin conocer su modelo (su ADR-160, LEARNITO_INVESTIGACION §4.4).

POST /api/external/academy/agent/ask, con el token de la Academia (ACADEMY_INBOUND_API_TOKEN). Mismo contrato
que el /api/v1/agent/ask de la Academia:
  - con `catalogo`: true da las fuentes; una clave de fuente da sus datos (acotables con `buscar`);
  - con `plan` (por claves de dato, app/services/tablas/plan.py): lo resuelve el motor de tablas, sin IA;
  - con `buscar_datos` ({pregunta, palabras_clave, area}): el buscador del diccionario (tablas/buscar.py), sin IA;
  - solo con `pregunta`: todavía no (Work no tiene un Learnito que responda texto libre a otro sistema).

Quien pregunta viaja en `quien` ({email, rol}) y queda en el log. Hasta decidir la traducción de roles entre
sistemas, la Academia ve lo de alguien sin rol propio: sin montos y sin nómina ni gastos. Un solo salto: Work
no le pregunta a un tercero para responder.
"""
import logging
from datetime import datetime

from flask import jsonify, request

from app.api.external import bp
from app.decorators import require_academy_token
from app.services.tablas import buscar, motor

logger = logging.getLogger(__name__)


class _SistemaExterno:
    """Quien consulta desde otro sistema: sin rol de Work, así que sin montos ni tablas de admin."""
    role = None
    id = None


def _items(items):
    return [{k: i[k] for k in ('fuente', 'clave', 'detalle')} for i in items]


@bp.route('/agent/ask', methods=['POST'])
@require_academy_token
def agent_ask():
    cuerpo = request.get_json(silent=True) or {}
    logger.info(f"[agent/ask] quien={cuerpo.get('quien')} plan={cuerpo.get('plan')} pregunta={cuerpo.get('pregunta')}")
    if cuerpo.get('catalogo'):
        fuente = cuerpo['catalogo'] if isinstance(cuerpo['catalogo'], str) else None
        try:
            cat = motor.catalog(_SistemaExterno(), fuente or True, cuerpo.get('buscar'))
        except motor.MotorError as e:
            return jsonify({'success': False, 'errores': e.errores}), 422
        # La misma forma que el catálogo de la Academia: `datos` son las fuentes o, con fuente, sus datos.
        return jsonify({'success': True, 'metodo': 'Catálogo del motor de tablas de Work, sin IA', 'fuente': fuente,
                        'datos': cat['datos'] if fuente else cat,
                        'comparaciones': cat['comparaciones'] if fuente else None,
                        'as_of': datetime.utcnow().isoformat(timespec='seconds') + 'Z'})
    if isinstance(cuerpo.get('buscar_datos'), dict):
        pedido = cuerpo['buscar_datos']
        found = buscar.find(_SistemaExterno(), str(pedido.get('pregunta') or ''), pedido.get('palabras_clave') or [],
                            pedido.get('area') or [])
        return jsonify({'success': True, 'metodo': 'Buscador del diccionario de datos de Work, sin IA',
                        'texto': buscar.texto(found), 'fuentes': found['fuentes'],
                        'conceptos': _items(found['conceptos']), 'datos': _items(found['datos']),
                        'as_of': datetime.utcnow().isoformat(timespec='seconds') + 'Z'})
    if not cuerpo.get('plan'):
        errores = ['Work responde solo planes por ahora (sin `pregunta` con IA).']
        return jsonify({'success': False, 'errores': errores}), 422
    try:
        pagina = int(cuerpo.get('pagina') or 1)
    except (TypeError, ValueError):
        pagina = 1
    try:
        return jsonify(motor.run(_SistemaExterno(), cuerpo['plan'], pagina=pagina))
    except motor.MotorError as e:
        return jsonify({'success': False, 'errores': e.errores}), 422
