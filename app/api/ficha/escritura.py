"""Las escrituras de la ficha del lead: una ruta por accion.

Cada ruta hace tres cosas y nada mas: buscar la agenda (404 si no esta), comprobar el permiso del
bloque `permisos` de la lectura (403 con motivo si el rol no puede) y delegar en
`ficha_acciones_service`. La logica de negocio vive en los servicios que ya existian.

Que un `director_comercial` pueda confirmar y reportar por aca es el punto del ejercicio: por
`/api/closer/*` recibe 403 en todas las rutas, y por eso hoy hay dos modales para el mismo lead.
"""
from flask import jsonify, request
from flask_login import current_user

from app import db
from app.api.ficha import bp, sin_permiso
from app.services import ficha_acciones_service as acciones
from app.services.ficha_lead_service import permisos_de


def _agenda_y_permiso(appt_id, permiso):
    """(appt, respuesta_de_error). Exactamente una de las dos es None."""
    appt = acciones.buscar_agenda(appt_id)
    if not appt:
        return None, (jsonify({'message': 'Lead no encontrado'}), 404)
    if not permisos_de(current_user, appt)[permiso]:
        return None, sin_permiso(permiso)
    return appt, None


def _datos():
    return request.get_json(silent=True) or {}


def _ejecutar(appt_id, permiso, accion, exito=200):
    appt, error = _agenda_y_permiso(appt_id, permiso)
    if error:
        return error
    try:
        return jsonify(accion(appt, _datos(), current_user)), exito
    except acciones.ErrorDeAccion as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        # Los servicios del mazo levantan Exception con el motivo en el texto (ej. "Fecha de
        # reagenda requerida"): se devuelve tal cual en vez de un 500 sin explicacion.
        db.session.rollback()
        return jsonify({'message': str(e)}), 400


@bp.route('/<int:appt_id>/confirmacion', methods=['PATCH'])
def confirmacion(appt_id):
    """Etapa de confirmacion, «Cómo viene», dolores y nota para la llamada."""
    return _ejecutar(appt_id, 'confirmar', acciones.confirmacion)


@bp.route('/<int:appt_id>/resultado', methods=['POST'])
def resultado(appt_id):
    """El arbol de reporte de la llamada."""
    return _ejecutar(appt_id, 'reportar', acciones.resultado)


@bp.route('/<int:appt_id>/venta', methods=['POST'])
def venta(appt_id):
    """Declara una venta o cobra una cuota (via `SheetsService.post_to_sheets`)."""
    return _ejecutar(appt_id, 'reportar', acciones.venta, exito=201)


@bp.route('/<int:appt_id>/reprogramar', methods=['POST'])
def reprogramar(appt_id):
    return _ejecutar(appt_id, 'confirmar', acciones.reprogramar)


@bp.route('/<int:appt_id>/descartar', methods=['POST'])
def descartar(appt_id):
    return _ejecutar(appt_id, 'reportar', acciones.descartar)


@bp.route('/<int:appt_id>/closer', methods=['PATCH'])
def reasignar(appt_id):
    return _ejecutar(appt_id, 'reasignar', acciones.reasignar)


@bp.route('/<int:appt_id>/seguimiento', methods=['POST'])
def seguimiento(appt_id):
    return _ejecutar(appt_id, 'cobrar', acciones.seguimiento)


@bp.route('/<int:appt_id>/plan-cuotas', methods=['PUT'])
def plan_cuotas(appt_id):
    return _ejecutar(appt_id, 'cobrar', acciones.plan_cuotas)


@bp.route('/<int:appt_id>/baja', methods=['POST'])
def baja(appt_id):
    return _ejecutar(appt_id, 'cobrar', acciones.baja)


@bp.route('/<int:appt_id>/nota', methods=['POST'])
def nota(appt_id):
    return _ejecutar(appt_id, 'comentar', acciones.nota, exito=201)


@bp.route('/<int:appt_id>', methods=['DELETE'])
def eliminar(appt_id):
    appt, error = _agenda_y_permiso(appt_id, 'eliminar')
    if error:
        return error
    try:
        return jsonify(acciones.eliminar(appt, current_user)), 200
    except acciones.ErrorDeAccion as e:
        return jsonify({'message': str(e)}), 400


@bp.route('/vocabulario/<grupo>/opciones', methods=['POST'])
def agregar_opcion(grupo):
    """Crea una opcion nueva en el grupo "Otros" de un vocabulario abierto.

    Es lo que hace el boton "+ Agregar" del desplegable. La opcion es global: la ve todo el equipo
    en la lectura siguiente, que es el sentido de haberla escrito.
    """
    from app.services import ficha_vocabulario as voc

    label = (_datos().get('label') or '').strip()
    if not label:
        return jsonify({'message': 'Falta el nombre de la opción.'}), 400
    opcion = voc.agregar_opcion(grupo, label, current_user)
    if not opcion:
        return jsonify({'message': f'El grupo "{grupo}" no acepta opciones nuevas.'}), 400
    return jsonify(opcion), 201
