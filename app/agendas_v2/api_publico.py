"""API publica de Agendas 2.0 (/api/agendas-v2/publico): la pagina de reserva del lead.

Sin sesion y exenta de CSRF (la usa un visitante anonimo). Solo trabaja con la version PUBLICADA de
un evento activo con su funnel activo, y nunca devuelve emails ni horarios del equipo: los horarios
salen sin decir de que closer son, y el closer lo elige el servidor al reservar. Recien con la agenda
tomada el lead ve el nombre de su consultor (nada de contacto).
Contrato: docs/agendas_v2_api.md.
"""

import threading
import time
from collections import defaultdict, deque

from flask import Blueprint, jsonify, request

from app.agendas_v2 import servicio

bp = Blueprint('agendas_v2_publico', __name__)

NO_DISPONIBLE = ({'code': 'no_disponible', 'message': 'Este link no está disponible.'}, 404)

# Limite por IP, en memoria y por proceso: frena a un script que martilla el endpoint, no es una
# defensa distribuida. (pedidos, segundos)
LIMITES = {'horarios': (30, 60), 'reservas': (10, 60), 'conocido': (10, 60), 'avance': (60, 60)}
_pedidos = defaultdict(deque)
_candado = threading.Lock()


def _ip():
    # Railway pone la IP del visitante primera en X-Forwarded-For.
    reenviada = request.headers.get('X-Forwarded-For', '')
    return (reenviada.split(',')[0].strip() or request.remote_addr or '?')[:64]


def _excede(tipo):
    maximo, ventana = LIMITES[tipo]
    ahora = time.monotonic()
    with _candado:
        cola = _pedidos[(tipo, _ip())]
        while cola and cola[0] <= ahora - ventana:
            cola.popleft()
        if len(cola) >= maximo:
            return True
        cola.append(ahora)
        if len(_pedidos) > 10000:  # que la memoria no crezca sin limite
            for clave in [k for k, v in _pedidos.items() if not v][:5000]:
                del _pedidos[clave]
    return False


def _demasiados():
    return jsonify({'code': 'demasiados', 'message': 'Demasiados intentos, probá en un minuto.'}), 429


def _cuerpo():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else {}


@bp.route('/eventos/<funnel_slug>/<evento_slug>', methods=['GET'])
def evento_de_funnel(funnel_slug, evento_slug):
    x = servicio.evento_disponible(servicio.colecciones(), funnel_slug, evento_slug)
    return jsonify(servicio.vista_publica(*x)) if x else (jsonify(NO_DISPONIBLE[0]), NO_DISPONIBLE[1])


@bp.route('/eventos/<evento_slug>', methods=['GET'])
def evento_sin_funnel(evento_slug):
    x = servicio.evento_disponible(servicio.colecciones(), None, evento_slug)
    return jsonify(servicio.vista_publica(*x)) if x else (jsonify(NO_DISPONIBLE[0]), NO_DISPONIBLE[1])


@bp.route('/eventos/<evento_id>/horarios', methods=['POST'])
def horarios(evento_id):
    if _excede('horarios'):
        return _demasiados()
    d = servicio.colecciones()
    x = servicio.evento_publico(d, evento_id)
    if not x:
        return jsonify(NO_DISPONIBLE[0]), NO_DISPONIBLE[1]
    evento, form, _ = x
    return jsonify({'slots': servicio.horarios(d, evento, form, _cuerpo().get('resp'))})


@bp.route('/eventos/<evento_id>/conocido', methods=['POST'])
def conocido(evento_id):
    """{email} → si ya agendó antes: su primer nombre, sus datos tapados y su próxima agenda."""
    if _excede('conocido'):
        return _demasiados()
    x = servicio.evento_publico(servicio.colecciones(), evento_id)
    if not x:
        return jsonify(NO_DISPONIBLE[0]), NO_DISPONIBLE[1]
    email = str(_cuerpo().get('email') or '').strip().lower()[:120]
    r = servicio.conocido(x[1], email)
    if r.get('proxima'):
        r['proxima'] = {'inicio': servicio.ms_a_dt(r['proxima']['inicio']).isoformat(timespec='milliseconds') + 'Z'}
    return jsonify(r)


@bp.route('/eventos/<evento_id>/avance', methods=['POST'])
def avance(evento_id):
    """{resp, origen, en_calendario, datos_guardados}: el lead avanzó un paso. Solo para Stats (dónde se
    caen los que dejaron sus datos): no devuelve nada."""
    if _excede('avance'):
        return _demasiados()
    d = servicio.colecciones()
    x = servicio.evento_publico(d, evento_id)
    if not x:
        return jsonify(NO_DISPONIBLE[0]), NO_DISPONIBLE[1]
    servicio.registrar_avance(d, *x, _cuerpo())
    return '', 204


@bp.route('/reservas', methods=['POST'])
def reservar():
    if _excede('reservas'):
        return _demasiados()
    cuerpo = _cuerpo()
    d = servicio.colecciones()
    x = servicio.evento_publico(d, str(cuerpo.get('evento_id') or ''))
    if not x:
        return jsonify(NO_DISPONIBLE[0]), NO_DISPONIBLE[1]
    try:
        r, _ = servicio.reservar(d, *x, cuerpo)
    except servicio.ReservaRechazadaError as e:
        if e.code == 'ocupado':
            return jsonify({'code': 'ocupado', 'message': 'Ese horario se acaba de ocupar.'}), 409
        if e.code == 'ya_tiene':
            # Solo el horario (nunca el closer): el lead decide si la cambia o suma otra sesión.
            inicio = servicio.ms_a_dt(e.errores['inicio']).isoformat(timespec='milliseconds') + 'Z'
            return jsonify({'code': 'ya_tiene', 'agenda': {'inicio': inicio}}), 409
        return jsonify({'code': 'invalido', 'errores': e.errores}), 400
    if r.get('descalificada'):
        return jsonify({'descalificada': True}), 201

    def _iso(ms):
        return servicio.ms_a_dt(ms).isoformat(timespec='milliseconds') + 'Z'

    return jsonify(
        {'reserva': {'id': r['id'], 'inicio': _iso(r['inicio']), 'fin': _iso(r['fin']), 'duracion': r['duracion'],
                     'consultor': r.get('consultor')}}
    ), 201
