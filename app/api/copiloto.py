"""Copiloto de closers: el chat con Claude (ver app/services/claude_service.py).

Primera versión, para probar el dictado por voz: conversa pero todavía no tiene herramientas, así
que no ve deudas, cuotas ni el avance de los alumnos. El historial lo guarda la pantalla y lo manda
entero en cada turno (la API de Claude no guarda estado); acá se valida y se acota.
"""
from flask import Blueprint, jsonify, request
from flask_login import current_user

from app.decorators import copiloto_required
from app.services.claude_service import ClaudeService, ClaudeServiceError

bp = Blueprint('copiloto_api', __name__)

FEATURE = 'copiloto'
MAX_MENSAJES = 20
MAX_CARACTERES = 4000

SISTEMA = '\n\n'.join([
    'Sos el copiloto de los closers de Learnation, una academia que prepara médicos para el examen de '
    'residencia.',
    'Ayudás a un closer con su trabajo de ventas y cobranza: redactar mensajes de seguimiento a alumnos, '
    'ordenar lo que tiene que hacer y pensar cómo encarar una conversación.',
    'Todavía no tenés acceso a los datos del sistema: no ves deudas, cuotas, pagos ni el avance de los '
    'alumnos en la Academia. Si te piden uno de esos datos, decí que todavía no está conectado y no lo '
    'inventes. Si el closer te da el dato, usalo.',
    'Hablás en español rioplatense, con "vos". Respuestas cortas y directas. Los mensajes para alumnos, '
    'listos para copiar.',
])


def _validar(mensajes):
    """Mensaje de error, o None si la conversación es válida."""
    if not isinstance(mensajes, list) or not mensajes:
        return 'mensajes tiene que ser una lista con al menos un mensaje.'
    if len(mensajes) > MAX_MENSAJES:
        return f'La conversación es muy larga (máximo {MAX_MENSAJES} mensajes). Empezá una nueva.'
    for i, m in enumerate(mensajes):
        rol_esperado = 'user' if i % 2 == 0 else 'assistant'
        if not isinstance(m, dict) or m.get('role') != rol_esperado:
            return 'Los mensajes tienen que alternar closer y copiloto, empezando por el closer.'
        contenido = m.get('content')
        if not isinstance(contenido, str) or not contenido.strip():
            return 'Hay un mensaje vacío.'
        if len(contenido) > MAX_CARACTERES:
            return f'Un mensaje supera los {MAX_CARACTERES} caracteres.'
    if mensajes[-1]['role'] != 'user':
        return 'El último mensaje tiene que ser del closer.'
    return None


@bp.route('/mensaje', methods=['POST'])
@copiloto_required
def mensaje():
    mensajes = (request.get_json(silent=True) or {}).get('mensajes')
    error = _validar(mensajes)
    if error:
        return jsonify({'error': error}), 400

    try:
        respuesta = ClaudeService.create_message(
            FEATURE, current_user.id,
            system=SISTEMA,
            messages=[{'role': m['role'], 'content': m['content'].strip()} for m in mensajes],
            max_tokens=2048,
            output_config={'effort': 'low'},
        )
    except ClaudeServiceError as e:
        return jsonify({'error': str(e)}), e.status_code

    texto = ''.join(b.text for b in respuesta.content if b.type == 'text').strip()
    if respuesta.stop_reason == 'refusal' or not texto:
        return jsonify({'error': 'El copiloto no pudo responder eso. Probá reformularlo.'}), 502
    return jsonify({'texto': texto}), 200
