"""La lectura de la ficha del lead."""
from flask import jsonify, request
from flask_login import current_user

from app.api.ficha import bp, sin_permiso
from app.services import ficha_lead_service


def _entero(nombre):
    valor = request.args.get(nombre)
    try:
        return int(valor) if valor else None
    except (TypeError, ValueError):
        return None


@bp.route('/lead', methods=['GET'])
def lead():
    """`GET /api/ficha/lead?appointment_id=<id>` o `?client_id=<id>`.

    Al menos uno de los dos. El estado operativo cuelga de `Appointment` y el cobro de `Client`, y
    segun de donde se abra la ficha se tiene una clave o la otra.
    """
    appointment_id, client_id = _entero('appointment_id'), _entero('client_id')
    if not appointment_id and not client_id:
        return jsonify({'message': 'Falta appointment_id o client_id'}), 400

    datos = ficha_lead_service.ficha(appointment_id=appointment_id, client_id=client_id,
                                    usuario=current_user)
    if not datos:
        # 404 y no 403 tambien cuando el recurso existe pero queda fuera de alcance: un 403
        # confirmaria su existencia (mismo criterio que GET /api/comercial/clientes/<id>).
        return jsonify({'message': 'Lead no encontrado'}), 404
    return jsonify(datos), 200


@bp.route('/<int:appt_id>/fulfillment', methods=['GET'])
def fulfillment(appt_id):
    """Como le va al alumno dentro de la Academia (Learnation).

    Ruta propia y no parte de `GET /ficha/lead` porque es una llamada a OTRO sistema, con su
    timeout y su limite de peticiones por minuto: si viajara en la lectura de la ficha, abrir
    cualquier lead —incluso uno que nunca compro— dependeria de que la Academia este arriba.

    El permiso es `cobrar` y no uno propio: la audiencia es exactamente la misma (la direccion y
    el closer), y un permiso nuevo sin una politica distinta detras es una clave mas que mantener
    en los cuatro lugares donde se comprueba.
    """
    from app.services import ficha_fulfillment_service

    appt, client = ficha_lead_service.resolver_lead(appointment_id=appt_id)
    if not appt:
        return jsonify({'message': 'Lead no encontrado'}), 404
    if not ficha_lead_service.permisos_de(current_user, appt)['cobrar']:
        return sin_permiso('cobrar')

    ventas = ficha_lead_service._ventas_del_cliente(client)
    return jsonify(ficha_fulfillment_service.fulfillment(client, ventas)), 200


@bp.route('/<int:appt_id>/estado-venta', methods=['GET'])
def estado_venta(appt_id):
    """Como viene pagando este cliente el programa que se le esta vendiendo (`?programa=RR`).

    Es lo que el wizard de venta del mazo pedia a `/closer/sales/client-state`: cuanto pago, cuanto
    le falta, cuantas ventas tiene en ese programa y que tipos de pago siguen la secuencia
    (`allowed_types`, para AVISAR, no para bloquear). No viaja en `GET /ficha/lead` porque depende
    del programa que el closer elige en medio de la venta, y el de la ficha es el que ya tiene.

    Esa ruta es `/closer/*` y la direccion comercial recibe 403 ahi; por eso esta puerta, con el
    permiso de declarar la venta. Tampoco crea un cliente al consultar, como hace aquella cuando no
    le llega un id: aca la agenda ya tiene el suyo.
    """
    from app.services.sales_consistency_service import SalesConsistencyService

    appt, client = ficha_lead_service.resolver_lead(appointment_id=appt_id)
    if not appt:
        return jsonify({'message': 'Lead no encontrado'}), 404
    if not ficha_lead_service.permisos_de(current_user, appt)['reportar']:
        return sin_permiso('reportar')

    programa = (request.args.get('programa') or '').strip().upper()
    if programa not in SalesConsistencyService.PROGRAM_DEFAULT_TOTALS:
        return jsonify({'message': f'Programa desconocido: «{programa}».'}), 400
    client_id = client.id if client else None
    estado = SalesConsistencyService.get_client_payment_state(client_id, programa)
    estado['allowed_types'] = SalesConsistencyService.get_allowed_types(client_id, programa)
    estado['client_id'] = client_id
    return jsonify(estado), 200


@bp.route('/vocabulario', methods=['GET'])
def vocabulario():
    """Los vocabularios sueltos, sin un lead.

    Los necesita cualquier pantalla que ofrezca las mismas listas fuera de la ficha (un filtro de
    dolores, el selector de closer) sin tener que pedir una ficha entera para sacarlas.
    """
    from app.services import ficha_vocabulario as voc
    return jsonify(voc.vocabulario()), 200
