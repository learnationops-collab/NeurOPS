"""Conector MCP de Work para claude.ai (25/11/2026): lo usa la tabla de Testeo de Learnation Marketing.

Un servidor MCP mínimo (transporte HTTP, respuestas JSON, sin SSE) con UNA herramienta de solo lectura,
`metricas_publicacion` (`publicacion_metricas_service`). Se agrega en claude.ai como conector propio con la
dirección `https://work.thelearnation.com/api/mcp/<MCP_PUBLICACION_TOKEN>`: el secreto va en la dirección
porque claude.ai no le manda cabeceras a un conector sin OAuth. Sin la variable (o corta) responde 503; con
un secreto que no coincide, 401. No escribe nada ni devuelve datos personales: solo conteos y montos.
"""
import json
import logging
import os
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from app.decorators import LARGO_MINIMO_DE_SECRETO, _iguales_en_tiempo_constante

logger = logging.getLogger(__name__)

bp = Blueprint('mcp_publicacion', __name__)

VERSIONES = ('2025-06-18', '2025-03-26', '2024-11-05')
PERIODO_MAXIMO = 400

HERRAMIENTA = {
    'name': 'metricas_publicacion',
    'title': 'Métricas de publicación',
    'description': ('Lo que pasó después del clic en los anuncios de Meta, para los días [desde, hasta]: por anuncio '
                    '(id de Meta) las visitas a la landing y los clics al grupo de WhatsApp; por campaña de Meta '
                    '(nombre) los entrantes, calificados, agendas, ventas y cobrado del embudo de DM; y las agendas, '
                    'ventas y cobrado del embudo de workshop (no se pueden partir por anuncio). Dinero neto, en USD.'),
    'inputSchema': {
        'type': 'object',
        'properties': {
            'desde': {'type': 'string', 'description': 'Primer día, AAAA-MM-DD. Por defecto, 6 días antes de hasta.'},
            'hasta': {'type': 'string', 'description': 'Último día, AAAA-MM-DD. Por defecto, hoy.'},
            'zona': {'type': 'string', 'description': 'Zona horaria de los días (IANA). Por defecto America/La_Paz.'},
        },
    },
    'annotations': {'readOnlyHint': True, 'openWorldHint': False},
}


def _respuesta(id_, result=None, error=None):
    cuerpo = {'jsonrpc': '2.0', 'id': id_}
    if error:
        cuerpo['error'] = error
    else:
        cuerpo['result'] = result
    return jsonify(cuerpo), 200


def _periodo(args):
    hasta = date.fromisoformat(args['hasta']) if args.get('hasta') else date.today()
    desde = date.fromisoformat(args['desde']) if args.get('desde') else hasta - timedelta(days=6)
    if desde > hasta:
        desde, hasta = hasta, desde
    if (hasta - desde).days > PERIODO_MAXIMO:
        raise ValueError(f'El período no puede pasar de {PERIODO_MAXIMO} días.')
    return desde, hasta


def _llamar(nombre, args):
    from app.services import publicacion_metricas_service

    if nombre != HERRAMIENTA['name']:
        return None
    try:
        desde, hasta = _periodo(args or {})
        datos = publicacion_metricas_service.metricas(desde, hasta, (args or {}).get('zona'))
    except ValueError as error:
        return {'content': [{'type': 'text', 'text': str(error)}], 'isError': True}
    return {'content': [{'type': 'text', 'text': json.dumps(datos, ensure_ascii=False)}], 'structuredContent': datos}


@bp.route('/<token>', methods=['GET', 'POST', 'DELETE'])
def mcp(token):
    esperado = os.environ.get('MCP_PUBLICACION_TOKEN', '')
    if len(esperado) < LARGO_MINIMO_DE_SECRETO:
        return jsonify({'message': 'MCP no configurado'}), 503
    if not _iguales_en_tiempo_constante(token, esperado):
        return jsonify({'message': 'Unauthorized'}), 401
    if request.method != 'POST':
        return jsonify({'message': 'Method Not Allowed'}), 405

    mensaje = request.get_json(silent=True)
    if not isinstance(mensaje, dict):
        return jsonify({'jsonrpc': '2.0', 'id': None, 'error': {'code': -32700, 'message': 'Parse error'}}), 400
    metodo, id_, params = mensaje.get('method'), mensaje.get('id'), mensaje.get('params') or {}
    if id_ is None:  # notificación (notifications/initialized y similares): no lleva respuesta
        return '', 202

    if metodo == 'initialize':
        pedida = params.get('protocolVersion')
        return _respuesta(id_, {
            'protocolVersion': pedida if pedida in VERSIONES else VERSIONES[0],
            'capabilities': {'tools': {'listChanged': False}},
            'serverInfo': {'name': 'Learnation Work', 'version': '1.0.0'},
        })
    if metodo == 'ping':
        return _respuesta(id_, {})
    if metodo == 'tools/list':
        return _respuesta(id_, {'tools': [HERRAMIENTA]})
    if metodo == 'tools/call':
        try:
            resultado = _llamar(params.get('name'), params.get('arguments'))
        except Exception as error:  # noqa: BLE001 — se informa al cliente y queda en el log
            logger.error(f'[MCP] {params.get("name")}: {error}')
            return _respuesta(id_, {'content': [{'type': 'text', 'text': 'Error interno de Work.'}], 'isError': True})
        if resultado is None:
            return _respuesta(id_, error={'code': -32602, 'message': f'Herramienta desconocida: {params.get("name")}'})
        return _respuesta(id_, resultado)
    if metodo in ('resources/list', 'prompts/list'):
        return _respuesta(id_, {metodo.split('/')[0]: []})
    return _respuesta(id_, error={'code': -32601, 'message': f'Método desconocido: {metodo}'})
