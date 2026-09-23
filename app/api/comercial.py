"""API del dashboard comercial.

Un solo tablero para tres audiencias, con el alcance resuelto SIEMPRE en el servidor:

  · dirección comercial y admin: todo el equipo, con selector de persona y de rol;
  · closer en "Mis datos": sus agendas y sus ventas, sin selector de equipo;
  · setter en "Mis datos": sus leads y las agendas que generó.

El frontend esconde controles, pero eso no protege nada: acá se ignora cualquier `rol` o
`miembro_id` que mande alguien que no tiene permiso para elegirlos (ver `alcance_de`). Un closer
que pida `miembro_id` de otro closer recibe sus propios datos, no un 403 — pedir una vista que
no le corresponde no es un error del usuario, es un parámetro que no se le respeta.
"""
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.models import Appointment
from app.models.user import ROLE_ADMIN, ROLE_CLOSER, ROLE_DIRECTOR_COMERCIAL, ROLE_SETTER
from app.services import comercial_analitica as analitica
from app.services import comercial_reporte as reporte
from app.services.booking_service import BookingService
from app.services.comercial_service import (
    POST_CALL, POST_CALL_A_CLOSER_RESULT, PRE_CALL, PRE_CALL_A_RESULT, ROL_CLOSERS, ROL_SETTERS,
    ROLES, ComercialService,
)

bp = Blueprint('comercial_api', __name__)

# Quién ve el equipo completo y puede elegir de quién son los datos.
ROLES_DIRECCION = (ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL)
# Quién entra al tablero, de una forma u otra.
ROLES_CON_ACCESO = ROLES_DIRECCION + (ROLE_CLOSER, ROLE_SETTER)

PERIODOS = [
    {'key': 'hoy', 'label': 'Hoy'}, {'key': 'ayer', 'label': 'Ayer'},
    {'key': '7d', 'label': '7 días'}, {'key': '30d', 'label': '30 días'},
    {'key': 'mes', 'label': 'Este mes'}, {'key': 'mes_pasado', 'label': 'Mes pasado'},
    {'key': '90', 'label': '90 días'}, {'key': 'custom', 'label': 'Personalizado'},
]
COMPARACIONES = [
    {'key': 'prev', 'label': 'Período anterior'}, {'key': 'month', 'label': 'Mismo período mes pasado'},
    {'key': 'year', 'label': 'Mismo período año pasado'}, {'key': 'none', 'label': 'Sin comparar'},
]
TABLAS = ('agendas', 'ventas', 'leads', 'generadas')


def alcance_de(usuario, rol_pedido, miembro_pedido):
    """(rol, miembro_id, puede_elegir) según quién pregunta.

    Para un closer o un setter el alcance es él mismo y el rol es el suyo, pida lo que pida: es
    el único punto donde se decide, así que ninguna vista de abajo puede olvidarse de filtrar.
    """
    if usuario.role == ROLE_CLOSER:
        return ROL_CLOSERS, usuario.id, False
    if usuario.role == ROLE_SETTER:
        return ROL_SETTERS, usuario.id, False

    rol = rol_pedido if rol_pedido in ROLES else ROL_CLOSERS
    miembro_id = None
    if miembro_pedido and miembro_pedido != 'all':
        try:
            miembro_id = int(miembro_pedido)
        except (TypeError, ValueError):
            miembro_id = None
    return rol, miembro_id, True


def _rangos():
    """(inicio, fin, inicio_comparado, fin_comparado) de los parámetros del header."""
    args = request.args
    start, end = ComercialService.rango(
        args.get('period', 'mes'), args.get('start_date'), args.get('end_date'))
    prev_start, prev_end = ComercialService.rango_comparado(
        start, end, args.get('compare', 'prev'), args.get('compare_start'), args.get('compare_end'))
    return start, end, prev_start, prev_end


def _fechas(start, end, prev_start, prev_end):
    return {'start': start.isoformat(), 'end': end.isoformat(),
            'compare_start': prev_start.isoformat() if prev_start else None,
            'compare_end': prev_end.isoformat() if prev_end else None}


def _alcance():
    return alcance_de(current_user, request.args.get('rol'), request.args.get('miembro_id'))


@bp.before_request
@login_required
def _solo_roles_con_acceso():
    if current_user.role not in ROLES_CON_ACCESO:
        return jsonify({'message': 'Forbidden'}), 403


@bp.route('/contexto', methods=['GET'])
def contexto():
    """Todo lo que el header y los chips necesitan saber una sola vez: qué puede elegir esta
    persona, quiénes son sus compañeros y el vocabulario de estados con sus colores."""
    rol, miembro_id, puede_elegir = _alcance()
    return jsonify({
        'rol': rol,
        'miembro_id': miembro_id,
        'puede_elegir_equipo': puede_elegir,
        'puede_reportar': current_user.role in ROLES_DIRECCION,
        'yo': {'id': current_user.id, 'nombre': current_user.username, 'rol': current_user.role},
        'miembros': ComercialService.miembros(rol) if puede_elegir else [],
        'periodos': PERIODOS,
        'comparaciones': COMPARACIONES,
        'estados': {'pre_call': PRE_CALL, 'post_call': POST_CALL},
    }), 200


@bp.route('/resumen', methods=['GET'])
def resumen():
    """Analizar → Dashboard."""
    rol, miembro_id, _ = _alcance()
    start, end, prev_start, prev_end = _rangos()
    datos = analitica.resumen(rol, start, end, prev_start, prev_end, miembro_id)
    return jsonify({**datos, 'dates': _fechas(start, end, prev_start, prev_end)}), 200


@bp.route('/comparativas', methods=['GET'])
def comparativas():
    """Analizar → Comparativas: ranking por métrica y mapa del equipo.

    Un closer o un setter ve el ranking completo con los nombres de sus compañeros. Es una
    decisión deliberada y no un descuido: el ranking ya se comparte hoy en el reporte diario del
    equipo, y la mitad del valor de la pantalla es saber contra qué se está comparando uno.
    """
    rol, miembro_id, _ = _alcance()
    start, end, prev_start, prev_end = _rangos()
    datos = analitica.comparativas(rol, start, end, prev_start, prev_end)
    return jsonify({**datos, 'yo': miembro_id, 'dates': _fechas(start, end, prev_start, prev_end)}), 200


@bp.route('/tabla', methods=['GET'])
def tabla():
    """Revisar: las filas de una tabla y los totales de lo filtrado.

    Los totales se calculan sobre las MISMAS filas que se devuelven, no sobre otra consulta: es
    lo que garantiza que el pie de la tabla cierre con lo que se ve arriba.
    """
    rol, miembro_id, _ = _alcance()
    start, end, _prev_start, _prev_end = _rangos()
    nombre = ComercialService.nombre_de(miembro_id)
    cual = request.args.get('tabla', 'agendas')
    if cual not in TABLAS:
        cual = 'agendas'
    basis = 'creacion' if request.args.get('basis') == 'creacion' else 'meet'

    if cual == 'ventas':
        # Las ventas se atribuyen al closer que las firmó: pedirlas acotadas por un setter daría
        # una lista vacía, no la suya. Con rol setters se devuelven sin acotar por persona.
        filas = ComercialService.ventas(start, end, closer_nombre=nombre if rol == ROL_CLOSERS else None)
        totales = ComercialService.totales_ventas(filas)
    elif cual == 'leads':
        filas = ComercialService.leads(start, end, setter_nombre=nombre if rol == ROL_SETTERS else None)
        totales = ComercialService.totales_leads(filas)
    elif cual == 'generadas':
        filas = ComercialService.agendas(start, end, setter_id=miembro_id, basis=basis)
        totales = ComercialService.totales_agendas(filas)
    else:
        closer_id = miembro_id if rol == ROL_CLOSERS else None
        setter_id = miembro_id if rol == ROL_SETTERS else None
        filas = ComercialService.agendas(start, end, closer_id=closer_id, setter_id=setter_id, basis=basis)
        totales = ComercialService.totales_agendas(filas)

    return jsonify({'tabla': cual, 'rol': rol, 'filas': filas, 'totales': totales,
                    'dates': _fechas(start, end, None, None)}), 200


def _puede_corregir(appt):
    """Quién puede corregir el estado de esta agenda: la dirección, el closer que la atiende y
    el setter que la generó. Nadie toca las filas de otro."""
    if current_user.role in ROLES_DIRECCION:
        return True
    if current_user.role == ROLE_CLOSER:
        return appt.closer_id == current_user.id
    if current_user.role == ROLE_SETTER:
        return appt.setter_id == current_user.id
    return False


@bp.route('/agendas/<int:agenda_id>', methods=['PATCH'])
def corregir_agenda(agenda_id):
    """Corrige el pre call o el post call de una agenda desde el modal del lead.

    Escribe en las mismas columnas que el mazo del closer (`result` / `closer_result`), no en un
    campo propio: si no, el dashboard y el mazo mostrarían dos verdades distintas de la misma
    llamada. Cada cambio deja su rastro en `lead_event_logs` con el valor anterior, que es lo que
    permite revertirlo si alguien se equivoca.
    """
    appt = db.session.get(Appointment, agenda_id)
    if not appt:
        return jsonify({'message': 'No existe esa agenda'}), 404
    if not _puede_corregir(appt):
        return jsonify({'message': 'Forbidden'}), 403

    datos = request.get_json(silent=True) or {}
    campo, valor = datos.get('campo'), datos.get('valor')

    if campo == 'pre_call' and valor in PRE_CALL_A_RESULT:
        anterior, columna, nuevo = appt.result, 'result', PRE_CALL_A_RESULT[valor]
        appt.result = nuevo
    elif campo == 'post_call' and valor in POST_CALL_A_CLOSER_RESULT:
        anterior, columna, nuevo = appt.closer_result, 'closer_result', POST_CALL_A_CLOSER_RESULT[valor]
        appt.closer_result = nuevo
        # Darle un resultado a la llamada es reportarla: sin esto, la agenda seguiria apareciendo
        # en el mazo del closer como pendiente de reportar.
        appt.closer_processed = valor != 'pendiente'
    else:
        return jsonify({'message': 'Campo o valor no admitido'}), 400

    db.session.commit()
    BookingService.log_lead_event(
        appt.id, current_user.id, 'status_changed',
        '{} corrigió {} desde el dashboard comercial: {!r} -> {!r}.'.format(
            current_user.username, columna, anterior, nuevo))

    return jsonify({'id': appt.id, 'campo': campo, 'valor': valor, 'anterior': anterior}), 200


# --- Reportar: el reporte diario de la direccion comercial ------------------------------------
# Solo la direccion. Para un closer o un setter la seccion ni siquiera aparece en el dock, pero
# el permiso se comprueba igual acá: esconder el boton no es proteger la ruta.

def _solo_direccion():
    return current_user.role in ROLES_DIRECCION


@bp.route('/reporte/hoy', methods=['GET'])
def reporte_hoy():
    """Paso 1 del wizard: los números del día y el estado de reporte de cada persona."""
    if not _solo_direccion():
        return jsonify({'message': 'Forbidden'}), 403
    fecha = ComercialService.fecha_o_hoy(request.args.get('fecha'))
    return jsonify(reporte.dia_del_equipo(fecha)), 200


@bp.route('/reporte/constancia', methods=['GET'])
def reporte_constancia():
    """Constancia de carga: una fila por persona y una celda por día de los últimos N."""
    if not _solo_direccion():
        return jsonify({'message': 'Forbidden'}), 403
    fecha = ComercialService.fecha_o_hoy(request.args.get('fecha'))
    try:
        dias = int(request.args.get('dias') or 14)
    except (TypeError, ValueError):
        dias = 14
    return jsonify(reporte.constancia(fecha, dias)), 200


@bp.route('/reporte', methods=['POST'])
def guardar_reporte():
    """Guarda el reporte del día. Volver a guardar el mismo día lo actualiza."""
    if not _solo_direccion():
        return jsonify({'message': 'Forbidden'}), 403
    datos = request.get_json(silent=True) or {}
    fecha = ComercialService.fecha_o_hoy(datos.get('fecha'))
    guardado = reporte.guardar(current_user, datos, fecha)
    return jsonify(guardado.to_dict()), 200


@bp.route('/reportes', methods=['GET'])
def reportes():
    """Historial: todos los días, o el registro de trabajo de una persona."""
    if not _solo_direccion():
        return jsonify({'message': 'Forbidden'}), 403
    miembro_id = request.args.get('miembro_id')
    try:
        miembro_id = int(miembro_id) if miembro_id else None
    except (TypeError, ValueError):
        miembro_id = None
    return jsonify(reporte.historial(miembro_id)), 200
