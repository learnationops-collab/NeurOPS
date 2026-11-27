"""Learnito de Learnation Marketing en Work (ADR-W280): la capacidad `sample` del artifact, con la API de Claude
de Work (`ClaudeService`, que registra el gasto en `AiUsage` bajo la función `learnation_marketing`).

Una vuelta por pedido: la página (su puente) manda la conversación y sus herramientas; si Claude pide una,
el puente la corre en la página y vuelve con el resultado. Las herramientas son funciones de la página
(reintentar, poner un parámetro, guardar una conversación…), por eso el bucle vive del lado del navegador.
"""
from app.services.claude_service import ClaudeService, ClaudeServiceError

FUNCION = 'learnation_marketing'
MODELOS = {'quick': 'claude-haiku-5-5', 'default': 'claude-sonnet-5-5', 'complex': 'claude-opus-5-5'}
MAX_TOKENS = 8000
MAX_IMAGENES = 4
TIPOS_DE_IMAGEN = {'image/png', 'image/jpeg', 'image/gif', 'image/webp'}


class ErrorDeLearnito(Exception):
    def __init__(self, code, message, status=502):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _con_imagenes(mensajes, imagenes):
    if not imagenes:
        return mensajes
    bloques = [{'type': 'image', 'source': {'type': 'base64', 'media_type': i['media_type'], 'data': i['data']}}
               for i in imagenes[:MAX_IMAGENES] if i.get('media_type') in TIPOS_DE_IMAGEN and i.get('data')]
    if not bloques:
        return mensajes
    for m in mensajes:
        if m.get('role') == 'user':
            contenido = m['content'] if isinstance(m['content'], list) else [{'type': 'text', 'text': str(m['content'])}]
            m['content'] = bloques + contenido
            break
    return mensajes


def _herramientas(tools):
    out = []
    for t in tools or []:
        if not t.get('name'):
            continue
        out.append({'name': str(t['name'])[:64], 'description': str(t.get('description') or '')[:2000],
                    'input_schema': t.get('input_schema') or t.get('inputSchema') or {'type': 'object', 'properties': {}}})
    return out


def preguntar(user_id, cuerpo):
    mensajes = cuerpo.get('messages') or []
    if not mensajes or mensajes[-1].get('role') != 'user':
        raise ErrorDeLearnito('invalid_argument', 'La conversación tiene que terminar en un mensaje del usuario.', 400)
    params = {'messages': _con_imagenes(mensajes, cuerpo.get('images')), 'max_tokens': MAX_TOKENS}
    tools = _herramientas(cuerpo.get('tools'))
    if tools:
        params['tools'] = tools
    if cuerpo.get('system'):
        params['system'] = str(cuerpo['system'])
    modelo = MODELOS.get(cuerpo.get('model_tier') or 'default', MODELOS['default'])
    try:
        r = ClaudeService.create_message(FUNCION, user_id, model=modelo, **params)
    except ClaudeServiceError as e:
        codigo = 'rate_limited' if 'rate' in str(e).lower() else 'unavailable'
        raise ErrorDeLearnito(codigo, str(e), getattr(e, 'status_code', 502)) from e
    return {'content': [b.model_dump(exclude_none=True) for b in r.content], 'stop_reason': r.stop_reason}
