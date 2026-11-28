"""«Pedir actualización» desde la ficha (ADR-W275): listar, pedir, responder y escuchar los audios."""
import io

from flask import jsonify, request, send_file
from flask_login import current_user

from app import db
from app.api.ficha import bp
from app.models import UpdateRequest
from app.services import avisos_service
from app.services import ficha_acciones_service as acciones
from app.services import pedido_actualizacion_service as pedidos


def _no_encontrado():
    return jsonify({'message': 'Lead no encontrado'}), 404


@bp.route('/<int:appt_id>/pedidos', methods=['GET'])
def listar_pedidos(appt_id):
    appt = acciones.buscar_agenda(appt_id)
    if not appt:
        return _no_encontrado()
    # Con la ficha abierta, los avisos de pedidos de este lead ya se vieron.
    for tipo in ('pedido_actualizacion', 'respuesta_actualizacion'):
        avisos_service.marcar_leidos(current_user, appt.person_uuid, tipo)
    return jsonify({'pedidos': [pedidos.a_dict(p, current_user) for p in pedidos.de_la_agenda(appt_id)],
                    'puede_pedir': not current_user.tiene_rol(pedidos.ROL_CONFIRMA)})


@bp.route('/<int:appt_id>/pedidos', methods=['POST'])
def crear_pedido(appt_id):
    appt = acciones.buscar_agenda(appt_id)
    if not appt:
        return _no_encontrado()
    try:
        p = pedidos.crear(appt, current_user, request.form.get('mensaje'), request.files.get('audio'))
    except pedidos.PedidoError as e:
        return jsonify({'message': str(e)}), e.codigo
    return jsonify({'pedido': pedidos.a_dict(p, current_user)}), 201


@bp.route('/pedidos/<int:pedido_id>/respuesta', methods=['POST'])
def responder_pedido(pedido_id):
    p = db.session.get(UpdateRequest, pedido_id)
    if not p:
        return jsonify({'message': 'Pedido no encontrado'}), 404
    try:
        p = pedidos.responder(p, current_user, request.form.get('texto'), request.files.get('audio'))
    except pedidos.PedidoError as e:
        return jsonify({'message': str(e)}), e.codigo
    return jsonify({'pedido': pedidos.a_dict(p, current_user)})


@bp.route('/pedidos/<int:pedido_id>/audio/<cual>', methods=['GET'])
def audio_pedido(pedido_id, cual):
    p = db.session.get(UpdateRequest, pedido_id)
    if not p or cual not in ('pedido', 'respuesta'):
        return jsonify({'message': 'Audio no encontrado'}), 404
    datos, tipo = (p.audio, p.audio_mime) if cual == 'pedido' else (p.reply_audio, p.reply_audio_mime)
    if not datos:
        return jsonify({'message': 'Audio no encontrado'}), 404
    return send_file(io.BytesIO(datos), mimetype=tipo, conditional=True, max_age=3600)
