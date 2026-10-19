"""Learnito, el copiloto de closers: el chat con Claude (ver app/services/claude_service.py).

Al closer le da herramientas de solo lectura (app/services/copiloto_herramientas.py): sus agendas,
la deuda de un cliente y quiénes más le deben. Con herramientas, una pregunta son varias llamadas a
Claude: él pide una herramienta, Work la ejecuta con la sesión del closer y se la devuelve.

Para gastar poco:
- La pantalla guarda el historial y lo manda entero en cada turno (la API no guarda estado), pero
  SOLO el texto: los resultados de herramientas de turnos anteriores no se reenvían.
- Hasta `MAX_MENSAJES` mensajes por conversación y `MAX_TOKENS` de salida por llamada.
- Tope de `TOPE_MENSUAL_USD` por persona y por mes, sumando todo su uso de la IA (`ai_usage`).
"""
from datetime import date, timedelta
from decimal import Decimal

from flask import Blueprint, jsonify, request
from flask_login import current_user

from app.decorators import copiloto_required
from app.services.claude_service import ClaudeService, ClaudeServiceError, gasto_del_mes, inicio_del_mes
from app.services.copiloto_herramientas import HERRAMIENTAS, ejecutar
from app.services.user_time_service import hoy_del_usuario

bp = Blueprint('copiloto_api', __name__)

FEATURE = 'copiloto'
MAX_MENSAJES = 10
MAX_CARACTERES = 4000
MAX_TOKENS = 1024
# Vueltas de herramienta por pregunta: alcanza para pedir dos o tres datos y contestar.
MAX_VUELTAS = 4
TOPE_MENSUAL_USD = Decimal('8')

SISTEMA = '\n\n'.join([
    'Sos Learnito, el copiloto de los closers de Learnation, una academia que prepara médicos para el '
    'examen de residencia.',
    'Ayudás al closer con ventas y cobranza: sus agendas, quién le debe, mensajes de seguimiento y cómo '
    'encarar una conversación.',
    'Los datos salen solo de tus herramientas. Si no tenés una herramienta para algo (por ejemplo, el '
    'avance de un alumno en la Academia), decí que todavía no está conectado. Nunca inventes datos.',
    'Español rioplatense, con "vos". Respuestas cortas. Los mensajes para alumnos, listos para copiar.',
    'Texto plano: la pantalla no muestra markdown, así que nada de asteriscos, # ni >. Para listas, una '
    'línea por ítem.',
])
SIN_HERRAMIENTAS = ('Todavía no ves datos del sistema (agendas, deudas, avance): si te piden uno, decí que '
                    'por ahora solo se conectan para los closers.')


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


def _uso(user_id):
    gastado = gasto_del_mes(user_id)
    inicio = inicio_del_mes().date()
    renueva = (inicio + timedelta(days=32)).replace(day=1)
    return {
        'gastado_usd': float(round(gastado, 4)),
        'tope_usd': float(TOPE_MENSUAL_USD),
        'porcentaje': min(100, round(float(gastado / TOPE_MENSUAL_USD) * 100, 1)),
        'renueva': renueva.isoformat(),
    }


def _conversar(historial, con_herramientas):
    """Llama a Claude hasta que conteste con texto, ejecutando las herramientas que pida."""
    hoy = hoy_del_usuario(current_user) if con_herramientas else date.today()
    partes = [SISTEMA] if con_herramientas else [SISTEMA, SIN_HERRAMIENTAS]
    params = {
        'system': '\n\n'.join([*partes, f'Hoy es {hoy.isoformat()}.']),
        'max_tokens': MAX_TOKENS,
        'output_config': {'effort': 'low'},
    }
    if con_herramientas:
        params['tools'] = HERRAMIENTAS
    for _ in range(MAX_VUELTAS):
        respuesta = ClaudeService.create_message(FEATURE, current_user.id, messages=historial, **params)
        if respuesta.stop_reason != 'tool_use':
            return respuesta
        historial.append({'role': 'assistant', 'content': respuesta.content})
        resultados = []
        for bloque in respuesta.content:
            if bloque.type != 'tool_use':
                continue
            texto, es_error = ejecutar(bloque.name, bloque.input, current_user)
            resultado = {'type': 'tool_result', 'tool_use_id': bloque.id, 'content': texto}
            if es_error:
                resultado['is_error'] = True
            resultados.append(resultado)
        historial.append({'role': 'user', 'content': resultados})
    return None


@bp.route('/uso', methods=['GET'])
@copiloto_required
def uso():
    return jsonify(_uso(current_user.id)), 200


@bp.route('/mensaje', methods=['POST'])
@copiloto_required
def mensaje():
    mensajes = (request.get_json(silent=True) or {}).get('mensajes')
    error = _validar(mensajes)
    if error:
        return jsonify({'error': error}), 400
    if gasto_del_mes(current_user.id) >= TOPE_MENSUAL_USD:
        return jsonify({'error': f'Llegaste al tope de uso de este mes (US${TOPE_MENSUAL_USD:.0f}). '
                                 'Se renueva el 1°.', 'uso': _uso(current_user.id)}), 429

    historial = [{'role': m['role'], 'content': m['content'].strip()} for m in mensajes]
    try:
        respuesta = _conversar(historial, con_herramientas=current_user.role == 'closer')
    except ClaudeServiceError as e:
        return jsonify({'error': str(e), 'uso': _uso(current_user.id)}), e.status_code

    texto = ''
    if respuesta is not None:
        texto = ''.join(b.text for b in respuesta.content if b.type == 'text').strip()
    if respuesta is None or respuesta.stop_reason == 'refusal' or not texto:
        return jsonify({'error': 'Learnito no pudo responder eso. Probá reformularlo.',
                        'uso': _uso(current_user.id)}), 502
    return jsonify({'texto': texto, 'uso': _uso(current_user.id)}), 200
