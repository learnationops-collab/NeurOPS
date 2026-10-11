"""API de gestion de Agendas 2.0 (/api/agendas-v2): la usa Thalamus, la herramienta del director
comercial. Toda ruta exige sesion; la guarda vive en el before_request, asi que ninguna vista puede
olvidarse de chequearlo. La direccion configura todo. El setter (10/10/2026) entra a mirar: solo las
lecturas de VISTAS_DE_LECTURA y sin los datos personales de otros (`_para_lectura`).
Contrato: docs/agendas_v2_api.md.
"""

import re

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app.agendas_v2 import paquete, servicio
from app.agendas_v2.nucleo.normalizar import COLECCIONES
from app.models.user import ROLE_ADMIN, ROLE_CLOSER, ROLE_DIRECTOR_COMERCIAL, ROLE_SETTER

bp = Blueprint('agendas_v2_admin', __name__)

ROLES_CON_ACCESO = (ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL)
# Ven Thalamus sin cambiar nada: funnels, formularios, equipo y Stats, su link y la prueba del
# agendamiento. Lo que se configura es de todos (un funnel o un evento borrado deja sin agendas a todo
# el equipo), asi que queda para la direccion. Vale el rol ACTIVO, como en toda la app.
ROLES_DE_LECTURA = (ROLE_SETTER,)
VISTAS_DE_LECTURA = frozenset({'estado', 'estadisticas', 'version', 'ocupacion', 'usuarios'})
ID_VALIDO = re.compile(r'^[A-Za-z0-9_-]{1,40}$')

# Lo que un rol de lectura recibe de cada reserva: lo que dibuja la ocupacion de cada closer. Fuera
# quedan el contacto y las respuestas del lead (son leads de otros setters) y el link de Meet.
CAMPOS_DE_RESERVA_EN_LECTURA = (
    'id', 'estado', 'inicio_ms', 'fin_ms', 'duracion_min', 'margen_min', 'closer_id', 'evento_id', 'funnel_id', 'creada',
)


@bp.before_request
@login_required
def _guardia():
    if current_user.role in ROLES_CON_ACCESO:
        return None
    vista = (request.endpoint or '').rpartition('.')[2]
    if current_user.role in ROLES_DE_LECTURA and request.method == 'GET' and vista in VISTAS_DE_LECTURA:
        return None
    return jsonify({'message': 'Forbidden'}), 403


def _para_lectura():
    """True si la sesion solo mira: sus respuestas van sin datos personales ajenos."""
    return current_user.role not in ROLES_CON_ACCESO


def _validar(col, doc_id):
    if col not in COLECCIONES or not ID_VALIDO.match(doc_id or ''):
        return jsonify({'message': 'Not found'}), 404
    return None


def _cuerpo():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else {}


@bp.route('/estado', methods=['GET'])
def estado():
    """Todo lo que Thalamus necesita al abrir: colecciones, perfil propio, integraciones y reservas.
    `solo_lectura` le dice a la pantalla que esconda lo que se configura."""
    cols, reservas, lectura = servicio.colecciones(), servicio.reservas_para_estado(), _para_lectura()
    if lectura:
        # El email de cada persona de Team solo sirve para unirla a su cuenta, y eso es configurar.
        cols['personas'] = [{**p, 'email': ''} for p in cols['personas']]
        reservas = [{k: r[k] for k in CAMPOS_DE_RESERVA_EN_LECTURA if k in r} for r in reservas]
    return jsonify(
        {
            'cols': cols,
            'perfil': servicio.perfil_de(current_user.id),
            'integ': servicio.integraciones(),
            'reservas': reservas,
            'version': servicio.version(),
            'solo_lectura': lectura,
        }
    )


@bp.route('/estadisticas', methods=['GET'])
def estadisticas():
    """Los leads de los últimos 180 días para Stats: los que agendaron y los que se cayeron antes."""
    return jsonify({'leads': servicio.estadisticas()})


@bp.route('/version', methods=['GET'])
def version():
    return jsonify({'version': servicio.version()})


@bp.route('/<col>/<doc_id>', methods=['PUT'])
def reemplazar(col, doc_id):
    error = _validar(col, doc_id)
    if error:
        return error
    doc = servicio.guardar_doc(col, doc_id, _cuerpo(), usuario_id=current_user.id)
    return jsonify({'doc': doc, 'version': servicio.version()})


@bp.route('/<col>/<doc_id>', methods=['PATCH'])
def actualizar(col, doc_id):
    error = _validar(col, doc_id)
    if error:
        return error
    doc = servicio.guardar_doc(col, doc_id, _cuerpo(), usuario_id=current_user.id, parcial=True)
    if doc is None:
        return jsonify({'message': 'Not found'}), 404
    return jsonify({'doc': doc, 'version': servicio.version()})


@bp.route('/<col>/<doc_id>', methods=['DELETE'])
def borrar(col, doc_id):
    error = _validar(col, doc_id)
    if error:
        return error
    servicio.borrar_doc(col, doc_id)  # borrar algo que ya no esta no es un error
    return jsonify({'ok': True, 'version': servicio.version()})


@bp.route('/perfil', methods=['PUT'])
def perfil():
    return jsonify({'perfil': servicio.guardar_perfil(current_user.id, _cuerpo())})


@bp.route('/integraciones', methods=['PUT'])
def integraciones():
    integ = servicio.guardar_integraciones(_cuerpo())
    return jsonify({'integ': integ, 'version': servicio.version()})


@bp.route('/ocupacion', methods=['GET'])
def ocupacion():
    """Lo ocupado en el Google Calendar de cada persona de Team entre ?desde y ?hasta (ms), para
    Available. Como mucho 10 dias por pedido: el visor pide la semana que se ve."""
    desde, hasta = request.args.get('desde', type=int), request.args.get('hasta', type=int)
    if desde is None or hasta is None or not 0 < hasta - desde <= servicio.RANGO_MAX_OCUPACION_DIAS * servicio.DIA_MS:
        return jsonify({'message': 'Rango inválido'}), 400
    ocupacion = servicio.ocupacion_google(desde, hasta)
    if _para_lectura():
        # Lo ocupado sí; el título de cada evento del calendario de un closer no (el de sus agendas lleva
        # el nombre del lead). El visor ya los muestra como «Ocupado», igual que los privados.
        ocupacion = {
            pid: {**o, 'eventos': [{**e, 'titulo': None} for e in o.get('eventos') or []]} for pid, o in ocupacion.items()
        }
    return jsonify({'ocupacion': ocupacion})


@bp.route('/usuarios', methods=['GET'])
def usuarios():
    """Usuarios activos de la app. Por defecto los closers: Team (quienes atienden) suma personas solo
    desde aca, unidas por email. Con ?rol=setter, los setters: cada uno tiene su link en los funnels
    de setting. `yo` marca a la sesion (el setter ve solo su link). A un rol de lectura le llegan sin
    email (sumar a Team no es lo suyo)."""
    rol = ROLE_SETTER if request.args.get('rol') == 'setter' else ROLE_CLOSER
    lista = [{**u, 'yo': u['id'] == current_user.id} for u in servicio.usuarios_del_equipo((rol,))]
    if _para_lectura():
        lista = [{**u, 'email': ''} for u in lista]
    return jsonify({'usuarios': lista})


@bp.route('/paquete/prompt', methods=['GET'])
def paquete_prompt():
    """El prompt para armar un funnel con IA (paquete.py), con el equipo real de Team y lo que ya
    existe para reusar. Con ?evento=<id>, el de editar ese evento (trae su configuración actual); con
    ?funnel=<id>, el de completar ese funnel (armarle su primer agendamiento)."""
    d = servicio.colecciones()
    evento_id = request.args.get('evento')
    funnel_id = request.args.get('funnel')
    if funnel_id:
        completar = paquete.exportar_funnel(d, funnel_id)
        if not completar:
            return jsonify({'code': 'no_existe', 'message': 'Ese funnel ya no existe.'}), 404
        return jsonify({'prompt': paquete.prompt(d, completar=completar)})
    if not evento_id:
        return jsonify({'prompt': paquete.prompt(d)})
    actual = paquete.exportar(d, evento_id)
    if not actual:
        return jsonify({'code': 'no_existe', 'message': 'Ese evento ya no existe.'}), 404
    return jsonify({'prompt': paquete.prompt(d, actual)})


@bp.route('/paquete', methods=['POST'])
def paquete_importar():
    """{paquete, simular, evento?, funnel?}: revisa el JSON que devolvio la IA y, si no es simulacion,
    crea todo de una vez. Con `evento`, lo escribe encima de ese evento (edicion con IA); con `funnel`,
    arma el agendamiento adentro de ese funnel en vez de crear otro."""
    cuerpo = _cuerpo()
    d = servicio.colecciones()
    evento_id = cuerpo.get('evento') or None
    funnel_id = None if evento_id else (cuerpo.get('funnel') or None)
    plan, errores = paquete.revisar(d, cuerpo.get('paquete'), editando=evento_id, en_funnel=funnel_id)
    if errores:
        return jsonify({'code': 'invalido', 'errores': errores}), 400
    if cuerpo.get('simular'):
        return jsonify({'resumen': paquete.resumen(plan)})
    if evento_id:
        tocados = paquete.aplicar(d, plan, evento_id, usuario_id=current_user.id)
        return jsonify({'resumen': paquete.resumen(plan), 'editados': tocados, 'version': servicio.version()})
    creados = paquete.importar(d, plan, usuario_id=current_user.id, en_funnel=funnel_id)
    return jsonify({'resumen': paquete.resumen(plan), 'creados': creados, 'version': servicio.version()}), 201
