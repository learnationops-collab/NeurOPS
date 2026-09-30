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


def _error_de_accion(e):
    """El motivo, y cuando lo hay, el campo que lo causo y con quien choca (ver `ErrorDeAccion`)."""
    cuerpo = {'message': str(e)}
    if e.campo:
        cuerpo['campo'] = e.campo
    if getattr(e, 'choque', None):
        cuerpo['choque'] = e.choque
    return jsonify(cuerpo), e.codigo


def _con_accesos_de_bajas(resultado):
    """Si la acción dio de baja a un cliente, le corta el acceso a la Academia y lo dice.

    Va acá, una vez, y no en cada acción: la baja puede venir de «Dar de baja» o de «No va a pagar»
    en el reporte, y lo que tiene que pasar después es lo mismo. Corre cuando la acción ya comiteó:
    si la Academia falla, la baja queda igual y la respuesta trae el motivo en `acceso_academia`.
    """
    from app.services import ficha_academia

    acceso = ficha_academia.quitar_accesos_de_bajas(current_user)
    if acceso and isinstance(resultado, dict):
        return {**resultado, 'acceso_academia': acceso}
    return resultado


def _ejecutar(appt_id, permiso, accion, exito=200):
    appt, error = _agenda_y_permiso(appt_id, permiso)
    if error:
        return error
    try:
        resultado = accion(appt, _datos(), current_user)
    except acciones.ErrorDeAccion as e:
        return _error_de_accion(e)
    except Exception as e:
        # Los servicios del mazo levantan Exception con el motivo en el texto (ej. "Fecha de
        # reagenda requerida"): se devuelve tal cual en vez de un 500 sin explicacion.
        db.session.rollback()
        return jsonify({'message': str(e)}), 400
    return jsonify(_con_accesos_de_bajas(resultado)), exito


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


@bp.route('/cliente/<int:client_id>/agenda-de-venta', methods=['POST'])
def agenda_de_venta(client_id):
    """La agenda en la que declarar una venta de este cliente (ver `agenda_para_vender`).

    Es la entrada de «Declarar venta» del dock del closer, que antes era una pagina aparte: el
    closer elige al cliente en el buscador del mazo y la ficha se abre en esta agenda, en
    «Registrar una venta». 201 si hubo que crearla.
    """
    if not permisos_de(current_user)['reportar']:
        return sin_permiso('reportar')
    try:
        appt, creada = acciones.agenda_para_vender(client_id, current_user)
    except acciones.ErrorDeAccion as e:
        return _error_de_accion(e)
    if not appt:
        return jsonify({'message': 'Lead no encontrado'}), 404
    return jsonify({'appointment_id': appt.id, 'creada': creada}), (201 if creada else 200)


@bp.route('/cliente-nuevo/agenda-de-venta', methods=['POST'])
def cliente_nuevo_para_vender():
    """Venderle a alguien que no esta en el sistema (ver `cliente_para_vender`).

    Es el «¿No está? Registrar cliente nuevo» de «Declarar venta»: la pagina vieja le vendia a
    cualquiera, este o no cargado. `nuevo` dice si hubo que crear al cliente o si ya existia con
    ese correo, instagram o telefono (y entonces se abre el suyo). 201 si se creo.
    """
    if not permisos_de(current_user)['reportar']:
        return sin_permiso('reportar')
    try:
        appt, cliente, nuevo = acciones.cliente_para_vender(_datos(), current_user)
    except acciones.ErrorDeAccion as e:
        return _error_de_accion(e)
    return jsonify({'appointment_id': appt.id, 'client_id': cliente.id,
                    'nombre': cliente.full_name, 'nuevo': nuevo}), (201 if nuevo else 200)


@bp.route('/<int:appt_id>/reprogramar', methods=['POST'])
def reprogramar(appt_id):
    return _ejecutar(appt_id, 'confirmar', acciones.reprogramar)


@bp.route('/<int:appt_id>/descartar', methods=['POST'])
def descartar(appt_id):
    return _ejecutar(appt_id, 'reportar', acciones.descartar)


@bp.route('/<int:appt_id>/cancelar', methods=['POST'])
def cancelar(appt_id):
    return _ejecutar(appt_id, 'reportar', acciones.cancelar)


@bp.route('/<int:appt_id>/closer', methods=['PATCH'])
def reasignar(appt_id):
    return _ejecutar(appt_id, 'reasignar', acciones.reasignar)


@bp.route('/<int:appt_id>/seguimiento', methods=['POST'])
def seguimiento(appt_id):
    return _ejecutar(appt_id, 'cobrar', acciones.seguimiento)


@bp.route('/<int:appt_id>/seguimiento', methods=['PUT'])
def agendar_seguimiento(appt_id):
    """Agenda el seguimiento de ESTA agenda desde el historial, o reemplaza el que tiene.

    Es otra cosa que el `POST` de arriba, que es «Registrar seguimiento» de Acciones: un
    seguimiento de cobro con canal, que pasa por el guardado del mazo. Este elige el tipo, apunta
    a cualquier agenda del cliente y no toca el mazo (ver `ficha_seguimientos_service`).

    El permiso es `reportar`, el mismo con el que se corrige la agenda en la misma sección y con
    el que el árbol de reporte de la llamada programa un seguimiento de cualquier tipo.
    """
    from app.services import ficha_seguimientos_service as seguimientos

    return _ejecutar(appt_id, 'reportar', seguimientos.agendar)


@bp.route('/<int:appt_id>/seguimiento', methods=['PATCH'])
def corregir_seguimiento(appt_id):
    """El estado (pendiente/realizado), el día, el tipo y la nota del seguimiento de ESTA agenda,
    corregidos desde el historial. Mismo permiso que agendarlo."""
    from app.services import ficha_seguimientos_service as seguimientos

    return _ejecutar(appt_id, 'reportar', seguimientos.corregir)


@bp.route('/<int:appt_id>/seguimiento', methods=['DELETE'])
def borrar_seguimiento(appt_id):
    """Saca el seguimiento de ESTA agenda, desde el historial. Mismo permiso que agendarlo."""
    from app.services import ficha_seguimientos_service as seguimientos

    return _ejecutar(appt_id, 'reportar', seguimientos.borrar)


@bp.route('/<int:appt_id>/plan-cuotas', methods=['PUT'])
def plan_cuotas(appt_id):
    return _ejecutar(appt_id, 'cobrar', acciones.plan_cuotas)


@bp.route('/<int:appt_id>/plan-cuotas', methods=['DELETE'])
def borrar_plan(appt_id):
    """Borra el plan de cuotas entero del cliente, desde el historial. Es cobrar, como armarlo.
    Los pagos no se tocan (ver `ficha_acciones_service.borrar_plan`)."""
    return _ejecutar(appt_id, 'cobrar', acciones.borrar_plan)


@bp.route('/<int:appt_id>/total', methods=['PATCH'])
def total(appt_id):
    """El total a pagar que negocio el cliente, del que sale su deuda."""
    return _ejecutar(appt_id, 'cobrar', acciones.total_a_pagar)


@bp.route('/<int:appt_id>/datos', methods=['PATCH'])
def datos_del_lead(appt_id):
    """Nombre, telefono, correo e instagram del cliente de esta agenda, y el examen de la agenda.

    Es la misma correccion que `PATCH /closer/customers/<id>` con la misma normalizacion, pero con
    el permiso de la ficha (la direccion y cualquier closer, como esa ruta; ni setter ni triage) y
    rechazando lo que esa ruta guarda mal callada: ver `ficha_acciones_service.editar_datos`.
    """
    return _ejecutar(appt_id, 'editar_datos', acciones.editar_datos)


@bp.route('/<int:appt_id>/pago', methods=['POST'])
def crear_pago(appt_id):
    """Carga a mano un pago que nunca se registro, desde la seccion Pagos del historial.

    No es el `POST /venta` de arriba: ese DECLARA una venta y dispara todo lo que una venta
    implica (Sheets, n8n, avisos, Show up). Este solo corrige el registro: la venta y su espejo en
    la deuda (ver `ficha_pagos_service`). El permiso es `cobrar`, el mismo del resto del cobro.
    """
    from app.services import ficha_pagos_service as pagos

    return _ejecutar(appt_id, 'cobrar', pagos.crear, exito=201)


@bp.route('/<int:appt_id>/pago/<int:pago_id>', methods=['PATCH', 'DELETE'])
def pago(appt_id, pago_id):
    """Corrige o borra un pago del cliente desde el historial. Mismo permiso que cargarlo.

    El id del pago sale SOLO de la URL, nunca del cuerpo: el servicio comprueba que ese pago sea de
    este lead, y un id que viajara en el JSON se podria cambiar sin cambiar la ruta.
    """
    from functools import partial

    from app.services import ficha_pagos_service as pagos

    accion = pagos.borrar if request.method == 'DELETE' else pagos.corregir
    return _ejecutar(appt_id, 'cobrar', partial(accion, pago_id=pago_id))


@bp.route('/<int:appt_id>/evento', methods=['POST'])
def crear_evento(appt_id):
    """Agrega a mano una fila al registro de eventos. Mismo permiso que reescribirlas y borrarlas."""
    return _ejecutar(appt_id, 'reportar', acciones.crear_evento, exito=201)


@bp.route('/<int:appt_id>/evento/<int:evento_id>', methods=['PATCH', 'DELETE'])
def evento(appt_id, evento_id):
    """Reescribe o borra una fila del registro de eventos de este lead.

    El permiso es `reportar` —la direccion y el closer—, que es lo que se pidio. Ver la nota de
    `ficha_acciones_service`: con esto el registro deja de servir como auditoria.
    """
    accion = acciones.borrar_evento if request.method == 'DELETE' else acciones.editar_evento
    datos = _datos()
    datos['evento_id'] = evento_id
    appt, error = _agenda_y_permiso(appt_id, 'reportar')
    if error:
        return error
    try:
        return jsonify(accion(appt, datos, current_user)), 200
    except acciones.ErrorDeAccion as e:
        return jsonify({'message': str(e)}), 400


@bp.route('/<int:appt_id>/estado', methods=['PATCH'])
def estado(appt_id):
    """El pre call o el post call de esta agenda, corregidos desde el historial."""
    return _ejecutar(appt_id, 'reportar', acciones.estado_agenda)


@bp.route('/<int:appt_id>/agenda', methods=['POST'])
def agenda(appt_id):
    """Otra llamada con el mismo cliente. `appt_id` es la agenda desde la que se pide."""
    return _ejecutar(appt_id, 'confirmar', acciones.crear_agenda, exito=201)


@bp.route('/<int:appt_id>/agenda', methods=['PATCH'])
def editar_agenda(appt_id):
    """La fecha, la fuente y el closer de ESTA agenda, corregidos desde el historial.

    El permiso es `reportar`, el mismo con el que se corrige el estado en la misma fila. Cambiarle
    el closer es ademas reasignar y ese permiso se pide aparte: hoy lo tienen los mismos roles,
    pero si mañana se separan, esta ruta no puede ser la puerta de atras de la reasignacion.
    """
    from app.services import ficha_agendas_service

    appt, error = _agenda_y_permiso(appt_id, 'reportar')
    if error:
        return error
    datos = _datos()
    otro_closer = datos.get('closer_id') not in (None, '') \
        and str(datos['closer_id']) != str(appt.closer_id)
    if otro_closer and not permisos_de(current_user, appt)['reasignar']:
        return sin_permiso('reasignar')
    try:
        return jsonify(ficha_agendas_service.editar_agenda(appt, datos, current_user)), 200
    except acciones.ErrorDeAccion as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        # Mismo trato que `_ejecutar`: un motivo en el texto en vez de un 500 sin explicacion.
        db.session.rollback()
        return jsonify({'message': str(e)}), 400


@bp.route('/<int:appt_id>/programa', methods=['PATCH'])
def programa(appt_id):
    """El programa que compro el cliente, escrito donde el resto del sistema lo lee."""
    return _ejecutar(appt_id, 'cobrar', acciones.programa)


@bp.route('/<int:appt_id>/baja', methods=['POST'])
def baja(appt_id):
    """Da de baja al cliente: deja de deber y sale de las listas de cobro (ver `baja_service`)."""
    return _ejecutar(appt_id, 'cobrar', acciones.baja)


@bp.route('/<int:appt_id>/revertir-baja', methods=['POST'])
def revertir_baja(appt_id):
    """Deshace la baja: el cliente vuelve a deber lo que debía. Mismo permiso que darla."""
    return _ejecutar(appt_id, 'cobrar', acciones.revertir_baja)


@bp.route('/<int:appt_id>/academia/acceso', methods=['POST'])
def acceso_academia(appt_id):
    """Da o renueva el acceso a la Academia hasta `vence` (ver `ficha_academia`). Es cobrar: es lo
    que hasta ahora solo pasaba al registrar un pago."""
    from app.services import ficha_academia
    return _ejecutar(appt_id, 'cobrar', ficha_academia.acceso)


@bp.route('/<int:appt_id>/academia/quitar', methods=['POST'])
def quitar_acceso_academia(appt_id):
    """Corta el acceso: el producto que pagó vence hoy. Pide `confirmo: true`."""
    from app.services import ficha_academia
    return _ejecutar(appt_id, 'cobrar', ficha_academia.quitar)


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
