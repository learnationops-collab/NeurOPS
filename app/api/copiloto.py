"""Learnito, el copiloto de closers: el chat con Claude (ver app/services/claude_service.py).

Al closer le da herramientas de solo lectura (app/services/copiloto_herramientas.py): sus agendas,
la deuda de un cliente y quiénes más le deben. Con herramientas, una pregunta son varias llamadas a
Claude: él pide una herramienta, Work la ejecuta con la sesión del closer y se la devuelve.

Para gastar poco:
- La pantalla guarda el historial y lo manda entero en cada turno (la API no guarda estado), pero
  SOLO el texto: los resultados de herramientas de turnos anteriores no se reenvían.
- Hasta `MAX_MENSAJES` mensajes por conversación y `MAX_TOKENS` de salida por llamada.
- Tope de `TOPE_MENSUAL_USD` por persona y por mes, sumando todo su uso de la IA (`ai_usage`). La
  pantalla muestra además una referencia diaria (el tope repartido en los días del mes).

La dirección (admin, operaciones, director comercial) habla con el cerebro de Learnito, que vive en la
Academia (su VISION/LEARNITO_COMO_SERVICIO.md, etapa 3): `/learnito` le pasa la pregunta o el botón que
tocó y quién es; la Academia guarda la conversación, cuenta el gasto con su tope y le pide los datos a
Work por su conector (app/services/learnito_conector.py).
"""
from datetime import date, timedelta
from decimal import Decimal

from flask import Blueprint, jsonify, request
from flask_login import current_user

from app.decorators import copiloto_required
from app.models.user import ROLE_ADMIN, ROLE_CLOSER, ROLE_DIRECTOR_COMERCIAL, ROLE_OPERATOR
from app.services import copiloto_datos, copiloto_herramientas
from app.services.claude_service import ClaudeService, ClaudeServiceError, gasto_del_mes, inicio_del_mes
from app.services.learnation_service import LearnationAPIError, LearnationService
from app.services.user_time_service import hoy_del_usuario, limites_dia_utc

bp = Blueprint('copiloto_api', __name__)

FEATURE = 'copiloto'
MAX_MENSAJES = 10
MAX_CARACTERES = 4000
MAX_TOKENS = 1024
# Vueltas de herramienta por pregunta: alcanza para pedir dos o tres datos y contestar. Con el motor de tablas
# son más (las fuentes, sus claves, uno o dos cálculos).
MAX_VUELTAS = 4
MAX_VUELTAS_DATOS = 6
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
# La dirección ve los datos de Work y de la Academia con el motor de tablas (copiloto_datos).
DIRECCION = 'Hablás con alguien de la dirección: ves los datos de Work y de la Academia con el motor de tablas.'
ROLES_DATOS = {ROLE_ADMIN, ROLE_OPERATOR, ROLE_DIRECTOR_COMERCIAL}


def _kit(user):
    """(herramientas, ejecutor, textos extra del sistema, vueltas) según el rol, o None si no tiene herramientas."""
    if user.role == ROLE_CLOSER:
        return copiloto_herramientas.HERRAMIENTAS, copiloto_herramientas.ejecutar, [], MAX_VUELTAS
    if user.role in ROLES_DATOS:
        return (copiloto_datos.HERRAMIENTAS, copiloto_datos.ejecutar, [DIRECCION, copiloto_datos.INSTRUCCIONES],
                MAX_VUELTAS_DATOS)
    return None


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


def _uso(user):
    """Lo gastado en el mes contra el tope, y lo de hoy contra lo que tocaría por día.

    El diario es una REFERENCIA (el tope del mes repartido en sus días), no un segundo tope: un día
    de mucho uso se compensa con otros. «Hoy» es el día calendario del usuario."""
    gastado = gasto_del_mes(user.id)
    inicio = inicio_del_mes().date()
    renueva = (inicio + timedelta(days=32)).replace(day=1)
    tope_diario = TOPE_MENSUAL_USD / (renueva - inicio).days
    inicio_hoy, _ = limites_dia_utc(user, hoy_del_usuario(user))
    hoy = gasto_del_mes(user.id, desde=inicio_hoy)
    return {
        'gastado_usd': float(round(gastado, 4)),
        'tope_usd': float(TOPE_MENSUAL_USD),
        'porcentaje': min(100, round(float(gastado / TOPE_MENSUAL_USD) * 100, 1)),
        'renueva': renueva.isoformat(),
        'hoy_usd': float(round(hoy, 4)),
        'tope_diario_usd': float(round(tope_diario, 2)),
        'porcentaje_hoy': round(float(hoy / tope_diario) * 100, 1),
    }


def _conversar(historial, kit):
    """Llama a Claude hasta que conteste con texto, ejecutando las herramientas que pida."""
    hoy = hoy_del_usuario(current_user) if kit else date.today()
    partes = [SISTEMA, *kit[2]] if kit else [SISTEMA, SIN_HERRAMIENTAS]
    params = {
        'system': '\n\n'.join([*partes, f'Hoy es {hoy.isoformat()}.']),
        'max_tokens': MAX_TOKENS,
        'output_config': {'effort': 'low'},
    }
    ejecutar = kit[1] if kit else None
    if kit:
        params['tools'] = kit[0]
    for _ in range(kit[3] if kit else MAX_VUELTAS):
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


def _cerebro(user):
    """Si la persona habla con el cerebro de la Academia (la dirección) en vez de con el copiloto de acá."""
    return user.role in ROLES_DATOS


def _quien(user):
    datos = {'id': user.id, 'nombre': user.username or user.email, 'email': user.email, 'rol': user.role,
             'zona': user.timezone}
    return {k: v for k, v in datos.items() if v}


def _a_la_academia(accion, cuerpo):
    """(respuesta, estado) del cerebro; un error suyo vuelve con su mensaje (tope, ocupado, sin clave…)."""
    try:
        return LearnationService.learnito(accion, {'quien': _quien(current_user), **cuerpo}), 200
    except LearnationAPIError as e:
        p = e.payload if isinstance(e.payload, dict) else {}
        return ({'error': p.get('mensaje') or 'Learnito no respondió. Probá de nuevo en un rato.',
                 'codigo': p.get('codigo')}, e.status_code or 502)


@bp.route('/uso', methods=['GET'])
@copiloto_required
def uso():
    # Con el cerebro, el uso lo lleva la Academia y llega con cada respuesta.
    if _cerebro(current_user):
        return jsonify({'modo': 'cerebro'}), 200
    return jsonify({**_uso(current_user), 'modo': 'local'}), 200


@bp.route('/learnito', methods=['POST'])
@copiloto_required
def learnito():
    """Una pregunta (o un botón de una respuesta anterior) al cerebro: {pregunta | boton, conversacion_id?}."""
    if not _cerebro(current_user):
        return jsonify({'error': 'Tu Learnito es el copiloto de closers.'}), 403
    cuerpo = request.get_json(silent=True) or {}
    pedido = {k: cuerpo[k] for k in ('pregunta', 'boton', 'conversacion_id') if cuerpo.get(k) not in (None, '')}
    if isinstance(pedido.get('pregunta'), str):
        pedido['pregunta'] = pedido['pregunta'].strip()[:MAX_CARACTERES]
    if not pedido.get('pregunta') and not isinstance(pedido.get('boton'), dict):
        return jsonify({'error': 'Escribí una pregunta.'}), 400
    data, estado = _a_la_academia('ask', pedido)
    if estado != 200:
        return jsonify(data), estado
    return jsonify({k: data.get(k) for k in ('conversacion_id', 'mensaje_indice', 'mensaje', 'uso')}), 200


@bp.route('/learnito/calificar', methods=['POST'])
@copiloto_required
def learnito_calificar():
    """{conversacion_id, calificacion: insatisfactoria | regular | satisfactoria | null, nota?}"""
    if not _cerebro(current_user):
        return jsonify({'error': 'Tu Learnito es el copiloto de closers.'}), 403
    cuerpo = request.get_json(silent=True) or {}
    data, estado = _a_la_academia('rate', {'conversacion_id': cuerpo.get('conversacion_id'),
                                           'calificacion': cuerpo.get('calificacion') or None,
                                           'nota': (cuerpo.get('nota') or '')[:500] or None})
    return jsonify(data), estado


@bp.route('/mensaje', methods=['POST'])
@copiloto_required
def mensaje():
    mensajes = (request.get_json(silent=True) or {}).get('mensajes')
    error = _validar(mensajes)
    if error:
        return jsonify({'error': error}), 400
    if gasto_del_mes(current_user.id) >= TOPE_MENSUAL_USD:
        return jsonify({'error': 'Llegaste al tope de uso de este mes. Se renueva el 1°.',
                        'uso': _uso(current_user)}), 429

    historial = [{'role': m['role'], 'content': m['content'].strip()} for m in mensajes]
    try:
        respuesta = _conversar(historial, _kit(current_user))
    except ClaudeServiceError as e:
        return jsonify({'error': str(e), 'uso': _uso(current_user)}), e.status_code

    texto = ''
    if respuesta is not None:
        texto = ''.join(b.text for b in respuesta.content if b.type == 'text').strip()
    if respuesta is None or respuesta.stop_reason == 'refusal' or not texto:
        return jsonify({'error': 'Learnito no pudo responder eso. Probá reformularlo.',
                        'uso': _uso(current_user)}), 502
    return jsonify({'texto': texto, 'uso': _uso(current_user)}), 200
