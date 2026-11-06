"""Los comprobantes de un pago, desde la ficha (ver `app/services/comprobantes`).

Mismo permiso que reportar o cobrar: la dirección y el closer. El pago tiene que ser de este lead
(`_venta_del_lead`), igual que al corregirlo.
"""
from flask import jsonify, request, send_file

from app import db
from app.api.ficha import bp
from app.api.ficha.escritura import _agenda_y_permiso, _error_de_accion
from app.services import ficha_pagos_service as pagos
from app.services.claude_service import ClaudeServiceError
from app.services.comprobantes import almacen, validacion
from app.services.ficha_acciones_service import ErrorDeAccion

PERMISO = ('cobrar', 'reportar')
_STATUS = {'sin_volumen': 503, 'invalido': 400, 'no_existe': 404}


def _pago(appt_id, pago_id):
    """(appt, venta, error)."""
    appt, error = _agenda_y_permiso(appt_id, PERMISO)
    if error:
        return None, None, error
    try:
        return appt, pagos._venta_del_lead(appt, pago_id), None
    except ErrorDeAccion as e:
        return None, None, _error_de_accion(e)


def _comprobante_error(e):
    return jsonify({'message': str(e)}), _STATUS.get(e.code, 400)


@bp.route('/<int:appt_id>/pago/<int:pago_id>/verificacion', methods=['GET'])
def verificacion_de_pago(appt_id, pago_id):
    _, venta, error = _pago(appt_id, pago_id)
    return error or jsonify(validacion.estado_de(venta))


@bp.route('/<int:appt_id>/pago/<int:pago_id>/comprobante', methods=['POST'])
def subir_comprobante(appt_id, pago_id):
    """Multipart con `archivo`. Learnito lo lee y responde el estado del pago."""
    from flask_login import current_user

    appt, venta, error = _pago(appt_id, pago_id)
    if error:
        return error
    archivo = request.files.get('archivo')
    if not archivo:
        return jsonify({'message': 'Falta el archivo del comprobante.'}), 400
    try:
        estado = validacion.subir(venta, archivo.read(), archivo.filename, archivo.mimetype, current_user)
    except almacen.ComprobanteError as e:
        db.session.rollback()
        return _comprobante_error(e)
    except ClaudeServiceError as e:
        db.session.rollback()
        return jsonify({'message': f'Learnito no pudo leer el comprobante: {e}'}), e.status_code
    pagos._anotar(appt, current_user, 'comprobante_subido', f'subió un comprobante del pago #{venta.id}',
                  f"{archivo.filename}: {_resumen_estado(estado)}")
    return jsonify(estado), 201


@bp.route('/<int:appt_id>/pago/<int:pago_id>/comprobante/<comprobante_id>', methods=['GET', 'DELETE'])
def comprobante(appt_id, pago_id, comprobante_id):
    from flask_login import current_user

    appt, venta, error = _pago(appt_id, pago_id)
    if error:
        return error
    entrada = next((e for e in (venta.transaction_evidence or []) if e.get('id') == comprobante_id), None)
    if not entrada:
        return jsonify({'message': 'Ese comprobante no está en este pago.'}), 404
    try:
        if request.method == 'GET':
            return send_file(almacen.ruta_de(entrada), mimetype=entrada['tipo'], download_name=entrada.get('nombre'))
        estado = validacion.quitar(venta, comprobante_id)
    except almacen.ComprobanteError as e:
        db.session.rollback()
        return _comprobante_error(e)
    pagos._anotar(appt, current_user, 'comprobante_quitado', f'quitó un comprobante del pago #{venta.id}',
                  f"{entrada.get('nombre')}: {_resumen_estado(estado)}")
    return jsonify(estado)


def _resumen_estado(estado):
    return {'verified': 'verificado', 'unverified': f"no cuadra ({estado.get('motivo')})",
            'pending': 'sin comprobante'}.get(estado['estado'], estado['estado'])
