"""Learnito en Work: el chat de todo el equipo con el cerebro de Learnito, que vive en la Academia (su
VISION/LEARNITO_COMO_SERVICIO.md y ADR-188 y ADR-190 de allá).

`/learnito` le pasa al cerebro la pregunta o el botón que tocó la persona y quién es; la Academia guarda la
conversación, cuenta el gasto con su tope (por sistema y por persona) y le pide los datos a Work por su conector
(app/services/learnito_conector.py), con el alcance de cada rol: la dirección ve todo y el resto, lo suyo y el
ranking (app/services/tablas/alcance.py). `/learnito/confirmar` hace (o descarta) la acción que propuso una
respuesta, y `/learnito/calificar` califica la conversación.

El "@" del chat y el menú "/" (ADR-194 de la Academia) los resuelve Work con lo suyo: `/learnito/personas` busca
clientes y gente del equipo, y `/learnito/acciones` lista las acciones simples, que el cerebro arma sin IA.

Dos reglas del cerebro (24/10): cada conversación tiene un tope de uso (la respuesta trae `uso.conversacion`; al
llegar, la Academia responde `conversacion_agotada`) y para abrir otra hay que calificar las anteriores
(`calificar_pendientes` con `pendientes`; `/learnito/pendientes` las lista).

Hasta el 24/10/2026 los closers tenían un copiloto propio acá (Claude con tres herramientas); esas herramientas
pasaron al conector (app/services/copiloto_herramientas.py).
"""
from flask import Blueprint, jsonify, request
from flask_login import current_user

from app.decorators import copiloto_required
from app.services import learnito_conector
from app.services.learnation_service import LearnationAPIError, LearnationService

bp = Blueprint('copiloto_api', __name__)

MAX_CARACTERES = 4000


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
        # Una acción que no se pudo hacer vuelve en `detalle` como «work no respondió «executeAction»: <motivo>».
        detalle = p.get('detalle') if isinstance(p.get('detalle'), list) else []
        motivo = str(detalle[0]).split('»: ', 1)[-1] if p.get('codigo') == 'pedido_invalido' and detalle else None
        error = {'error': motivo or p.get('mensaje') or 'Learnito no respondió. Probá de nuevo en un rato.',
                 'codigo': p.get('codigo')}
        # Para abrir otra conversación hay que calificar las anteriores: la Academia manda cuáles.
        if isinstance(p.get('pendientes'), list):
            error['pendientes'] = p['pendientes']
        return error, e.status_code or 502


@bp.route('/learnito', methods=['POST'])
@copiloto_required
def learnito():
    """Una pregunta (o un botón de una respuesta anterior) al cerebro: {pregunta | boton, conversacion_id?}."""
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


@bp.route('/learnito/confirmar', methods=['POST'])
@copiloto_required
def learnito_confirmar():
    """{conversacion_id, mensaje, texto?, descartar?}: hace la acción propuesta (con el texto editado) o la descarta."""
    cuerpo = request.get_json(silent=True) or {}
    if not isinstance(cuerpo.get('conversacion_id'), int) or not isinstance(cuerpo.get('mensaje'), int):
        return jsonify({'error': 'Falta la conversación o el mensaje.'}), 400
    pedido = {'conversacion_id': cuerpo['conversacion_id'], 'mensaje': cuerpo['mensaje']}
    if cuerpo.get('descartar'):
        pedido['descartar'] = True
    elif isinstance(cuerpo.get('texto'), str) and cuerpo['texto'].strip():
        pedido['texto'] = cuerpo['texto'].strip()[:MAX_CARACTERES]
    data, estado = _a_la_academia('confirm', pedido)
    return jsonify(data), estado


@bp.route('/learnito/personas', methods=['GET'])
@copiloto_required
def learnito_personas():
    """El "@" del chat: {personas: [{id, nombre, detalle, tipo: persona | equipo}]}, con el alcance de quien busca."""
    return jsonify({'personas': learnito_conector.mentions(current_user, request.args.get('q') or '')}), 200


@bp.route('/learnito/acciones', methods=['GET'])
@copiloto_required
def learnito_acciones():
    """El menú "/" del chat: {acciones: [{clave, nombre, detalle}]}."""
    return jsonify({'acciones': [{'clave': a['tipo'], 'nombre': a['nombre'], 'detalle': a['descripcion']}
                                 for a in learnito_conector.ACCIONES_SIMPLES]}), 200


@bp.route('/learnito/pendientes', methods=['GET'])
@copiloto_required
def learnito_pendientes():
    """Las conversaciones sin calificar de quien pregunta: {pendientes: [{id, titulo, fecha, porcentaje}]}."""
    data, estado = _a_la_academia('pending', {})
    if estado != 200:
        return jsonify(data), estado
    return jsonify({'pendientes': data.get('pendientes') or []}), 200


@bp.route('/learnito/calificar', methods=['POST'])
@copiloto_required
def learnito_calificar():
    """{conversacion_id, calificacion: insatisfactoria | regular | satisfactoria | null, nota?}"""
    cuerpo = request.get_json(silent=True) or {}
    data, estado = _a_la_academia('rate', {'conversacion_id': cuerpo.get('conversacion_id'),
                                           'calificacion': cuerpo.get('calificacion') or None,
                                           'nota': (cuerpo.get('nota') or '')[:500] or None})
    return jsonify(data), estado
